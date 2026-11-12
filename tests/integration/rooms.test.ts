// Аудитории и брони (docs/plans/rooms.md, ревью Codex 18): доступ A/B, правила, квоты, гонки.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { allPlanRooms } from "@/lib/campus/plans";
import { roomDayKeys } from "@/lib/campus/rules";
import { prisma } from "@/server/db";
import { bookRoom, cancelMyRoomBooking, getRoomDay, listMyRoomBookings } from "@/server/dal/rooms";
import * as session from "@/server/session";
import { actAs, expect404, makeStudent } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

type Who = Awaited<ReturnType<typeof actAs>>;
let A: Who;
let B: Who;
const day = () => roomDayKeys()[2]; // послезавтра: всё время ещё впереди
const tag = Date.now().toString(36);

/** Подменить сессию синхронно (для параллельных запросов от разных студентов). */
const sessionOf = (who: Who) => Object.freeze({ userId: who.userId, studentId: who.studentId, groupId: who.groupId });

async function freeStart(roomId: string, d = day(), minutes = 60) {
  const r = await getRoomDay(roomId, d);
  const f = r.free.find((x) => x.max >= minutes);
  if (!f) throw new Error(`нет свободного времени в ${roomId} ${d}`);
  return f.start;
}

beforeAll(async () => {
  A = await makeStudent(`room-a-${tag}`);
  B = await makeStudent(`room-b-${tag}`);
});
afterAll(async () => {
  await prisma.roomBooking.deleteMany({ where: { studentId: { in: [A.studentId, B.studentId] } } });
  await prisma.$disconnect();
});

describe("схема и БД", () => {
  it("каждая аудитория схемы есть в БД, занятия схематичных корпусов привязаны к аудиториям", async () => {
    const ids = allPlanRooms().map((r) => r.id);
    expect(await prisma.room.count({ where: { id: { in: ids } } })).toBe(ids.length);
    const orphan = await prisma.lesson.count({ where: { buildingId: { in: ["kronv", "lom-m"] }, online: false, room: { not: null }, roomId: null } });
    expect(orphan).toBe(0);
  });
});

describe("бронирование", () => {
  it("бронь в свободное время; повтор того же интервала другим студентом — отказ", async () => {
    await actAs(`room-a-${tag}`);
    const start = await freeStart("kronv-2101");
    const ok = await bookRoom({ roomId: "kronv-2101", day: day(), start, minutes: 60, purpose: "Тест A" });
    expect(ok.ok).toBe(true);
    await actAs(`room-b-${tag}`);
    const again = await bookRoom({ roomId: "kronv-2101", day: day(), start, minutes: 60, purpose: "Тест B" });
    expect(again).toEqual({ ok: false, error: "Это время только что заняли, выберите другое" });
  });

  it("правила: не бронируемая аудитория, нерабочее время, прошлое, неверная длительность", async () => {
    await actAs(`room-b-${tag}`);
    const notBookable = allPlanRooms().find((r) => !r.bookable)!;
    expect((await bookRoom({ roomId: notBookable.id, day: day(), start: "10:00", minutes: 60, purpose: "x y" })).ok).toBe(false);
    expect((await bookRoom({ roomId: "kronv-3310", day: day(), start: "20:30", minutes: 60, purpose: "поздно" })).ok).toBe(false);
    expect((await bookRoom({ roomId: "kronv-3310", day: roomDayKeys()[0], start: "08:00", minutes: 30, purpose: "прошлое" })).ok).toBe(false);
    expect((await bookRoom({ roomId: "kronv-3310", day: day(), start: "10:15", minutes: 60, purpose: "шаг" })).ok).toBe(false);
    expect((await bookRoom({ roomId: "kronv-3310", day: day(), start: "10:00", minutes: 240, purpose: "долго" })).ok).toBe(false);
    expect((await bookRoom({ roomId: "kronv-3310", day: "2030-01-01", start: "10:00", minutes: 60, purpose: "далеко" })).ok).toBe(false);
    expect((await bookRoom({ roomId: "kronv-3310", day: day(), start: "10:60", minutes: 60, purpose: "минуты" })).ok).toBe(false);
    expect((await bookRoom({ roomId: "kronv-3310", day: day(), start: "24:00", minutes: 30, purpose: "часы" })).ok).toBe(false);
    await expect404(bookRoom({ roomId: "no-such-room", day: day(), start: "10:00", minutes: 60, purpose: "нет" }));
  });

  it("нельзя занять время пары в аудитории", async () => {
    // Любая пара в аудитории со схемы в окне брони; аудиторию на время теста делаем бронируемой.
    const lesson = await prisma.lesson.findFirstOrThrow({
      where: { roomId: { not: null }, status: { not: "CANCELLED" }, startsAt: { gt: new Date(Date.now() + 3_600_000), lt: new Date(Date.now() + 5 * 86_400_000) } },
      orderBy: { startsAt: "asc" },
      include: { roomRef: true },
    });
    const wasBookable = lesson.roomRef!.bookable;
    await prisma.room.update({ where: { id: lesson.roomId! }, data: { bookable: true } });
    try {
      // Начало пары, округлённое вверх до шага 30 минут (пары начинаются в 08:10, 09:50…): интервал всё ещё внутри пары.
      const step = 30 * 60_000;
      const msk = new Date(Math.ceil(lesson.startsAt.getTime() / step) * step + 3 * 3_600_000).toISOString();
      await actAs(`room-b-${tag}`);
      expect(await bookRoom({ roomId: lesson.roomId!, day: msk.slice(0, 10), start: msk.slice(11, 16), minutes: 30, purpose: "Поверх пары" })).toEqual({
        ok: false,
        error: "В это время в аудитории занятие",
      });
    } finally {
      await prisma.room.update({ where: { id: lesson.roomId! }, data: { bookable: wasBookable } });
    }
  });

  it("квоты: одна бронь в день и не больше двух активных", async () => {
    const c = await makeStudent(`room-c-${tag}`);
    const [d0, d1, d2, d3] = roomDayKeys().slice(2, 6);
    expect((await bookRoom({ roomId: "kronv-3310", day: d0, start: await freeStart("kronv-3310", d0), minutes: 30, purpose: "Первая" })).ok).toBe(true);
    expect((await bookRoom({ roomId: "kronv-3406", day: d0, start: await freeStart("kronv-3406", d0), minutes: 30, purpose: "Тот же день" })).ok).toBe(false);
    expect((await bookRoom({ roomId: "kronv-3406", day: d1, start: await freeStart("kronv-3406", d1), minutes: 30, purpose: "Вторая" })).ok).toBe(true);
    const third = await bookRoom({ roomId: "kronv-1206", day: d2, start: await freeStart("kronv-1206", d2), minutes: 30, purpose: "Третья" });
    expect(third.ok).toBe(false);
    expect(d3).toBeTruthy();
    await prisma.roomBooking.deleteMany({ where: { studentId: c.studentId } });
  });

  it("гонка: два студента на один интервал — успешна ровно одна бронь", async () => {
    const d = roomDayKeys()[4];
    const start = await freeStart("lom-m-1205", d);
    vi.mocked(session.requireStudent).mockResolvedValueOnce(sessionOf(A)).mockResolvedValueOnce(sessionOf(B));
    const res = await Promise.all([
      bookRoom({ roomId: "lom-m-1205", day: d, start, minutes: 60, purpose: "Гонка A" }),
      bookRoom({ roomId: "lom-m-1205", day: d, start, minutes: 60, purpose: "Гонка B" }),
    ]);
    expect(res.filter((r) => r.ok)).toHaveLength(1);
  });

  it("гонка квоты: один студент в две разные аудитории в один день — успешна одна", async () => {
    const e = await makeStudent(`room-e-${tag}`);
    const d = roomDayKeys()[5];
    const [s1, s2] = [await freeStart("kronv-1206", d), await freeStart("lom-m-1101", d)];
    vi.mocked(session.requireStudent).mockResolvedValue(sessionOf(e));
    const res = await Promise.all([
      bookRoom({ roomId: "kronv-1206", day: d, start: s1, minutes: 30, purpose: "Квота 1" }),
      bookRoom({ roomId: "lom-m-1101", day: d, start: s2, minutes: 30, purpose: "Квота 2" }),
    ]);
    expect(res.filter((r) => r.ok)).toHaveLength(1);
    await prisma.roomBooking.deleteMany({ where: { studentId: e.studentId } });
  });
});

describe("доступ A/B", () => {
  it("B видит бронь A только как «занято»: без id, цели и студента; пары чужих групп без id", async () => {
    const mine = await prisma.roomBooking.findFirstOrThrow({ where: { studentId: A.studentId, status: "CONFIRMED" } });
    const key = new Date(mine.startsAt.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
    await actAs(`room-b-${tag}`);
    const view = await getRoomDay(mine.roomId, key);
    const json = JSON.stringify(view);
    expect(json).not.toContain(mine.id);
    expect(json).not.toContain(mine.purpose);
    expect(json).not.toContain(A.studentId);
    const theirs = view.items.find((i) => i.type === "booking" && i.startsAt.getTime() === mine.startsAt.getTime())!;
    expect(theirs).toMatchObject({ mine: false, bookingId: null, purpose: null });
    for (const i of view.items) if (i.type === "lesson" && !i.mine) expect(i.lessonId).toBeNull();
  });

  it("список «мои брони» — только свои; отмена чужой — 404, своей — успешно", async () => {
    const mine = await prisma.roomBooking.findFirstOrThrow({ where: { studentId: A.studentId, status: "CONFIRMED" } });
    await actAs(`room-b-${tag}`);
    expect((await listMyRoomBookings()).map((b) => b.id)).not.toContain(mine.id);
    await expect404(cancelMyRoomBooking(mine.id));
    expect((await prisma.roomBooking.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe("CONFIRMED");
    await actAs(`room-a-${tag}`);
    expect((await cancelMyRoomBooking(mine.id)).ok).toBe(true);
    await expect404(cancelMyRoomBooking(mine.id));
  });

  it("владелец брони — всегда из сессии: подставленный studentId игнорируется", async () => {
    await actAs(`room-b-${tag}`);
    const d = roomDayKeys()[6];
    const r = await bookRoom({ roomId: "lom-m-1309", day: d, start: await freeStart("lom-m-1309", d), minutes: 30, purpose: "Чужой владелец", studentId: A.studentId });
    expect(r.ok).toBe(true);
    const created = await prisma.roomBooking.findFirstOrThrow({ where: { purpose: "Чужой владелец" } });
    expect(created.studentId).toBe(B.studentId);
  });
});
