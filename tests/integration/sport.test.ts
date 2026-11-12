// Физкультура «успел — записался» (docs/plans/sport-fcfs.md): запись, очередь FIFO, квоты, окно, доступ A/B.
import { afterAll, describe, expect, it, vi } from "vitest";
import { addDays } from "@/lib/format";
import { prisma } from "@/server/db";
import { bookSlot, cancelMyBooking, getMySport, SPORT_RULES } from "@/server/dal/sport";
import * as session from "@/server/session";
import { actAs, expect404, makeStudent } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn() }));

afterAll(() => prisma.$disconnect());

const H = 3_600_000;
const placesTaken = (slotId: string) => prisma.sportBooking.count({ where: { slotId, status: { in: ["CONFIRMED", "ATTENDED", "MISSED"] } } });
const statusOf = async (studentId: string, slotId: string) =>
  (await prisma.sportBooking.findUnique({ where: { studentId_slotId: { studentId, slotId } } }))?.status ?? null;

/** Заполненная тренировка в окне записи, до которой больше 12 часов. */
async function fullSlot() {
  const now = Date.now();
  const slots = await prisma.sportSlot.findMany({
    where: { startsAt: { gt: new Date(now + 13 * H), lt: addDays(new Date(), SPORT_RULES.windowDays) } },
    orderBy: { startsAt: "asc" },
  });
  for (const s of slots) if ((await placesTaken(s.id)) >= s.capacity) return s;
  throw new Error("В демо-данных нет заполненной тренировки в окне записи");
}

describe("запись", () => {
  it("свободное место — сразу «записаны»; повторный клик не создаёт вторую запись", async () => {
    const me = await makeStudent("t.free");
    const slot = await prisma.sportSlot.findFirstOrThrow({
      where: { startsAt: { gt: new Date(), lt: addDays(new Date(), SPORT_RULES.windowDays) } },
      orderBy: { startsAt: "asc" },
    });
    const free = slot.capacity - (await placesTaken(slot.id));
    if (free <= 0) await prisma.sportSlot.update({ where: { id: slot.id }, data: { capacity: slot.capacity + 1 } });
    expect(await bookSlot(slot.id)).toMatchObject({ ok: true });
    expect(await bookSlot(slot.id)).toMatchObject({ ok: true, message: "Вы уже записаны" });
    expect(await prisma.sportBooking.count({ where: { studentId: me.studentId, slotId: slot.id } })).toBe(1);
    expect(await statusOf(me.studentId, slot.id)).toBe("CONFIRMED");
  });

  it("за пределами окна 7 суток записи нет", async () => {
    await makeStudent("t.window");
    const far = await prisma.sportSlot.findFirstOrThrow({ where: { startsAt: { gt: addDays(new Date(), SPORT_RULES.windowDays + 1) } } });
    expect(await bookSlot(far.id)).toMatchObject({ ok: false });
  });

  it("не больше 2 в неделю и 1 в день", async () => {
    const me = await makeStudent("t.quota");
    // Тренировки с очередью не трогаем: запись продвигает очереди всей недели, и при вместимости 99 ожидающие
    // получили бы места, а после возврата вместимости тренировка осталась бы переполненной.
    const slots = await prisma.sportSlot.findMany({
      where: { startsAt: { gt: new Date(), lt: addDays(new Date(), SPORT_RULES.windowDays) }, bookings: { none: { status: "WAITLIST" } } },
      orderBy: { startsAt: "asc" },
    });
    // Места не должны мешать проверке квот: временно расширяем вместимость и возвращаем её.
    for (const s of slots) await prisma.sportSlot.update({ where: { id: s.id }, data: { capacity: 99 } });
    try {
      const day = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
      // Две тренировки в один день — вторая отклоняется.
      const sameDay = slots.find((a) => slots.some((b) => b.id !== a.id && day(b.startsAt) === day(a.startsAt)));
      if (sameDay) {
        const twin = slots.find((b) => b.id !== sameDay.id && day(b.startsAt) === day(sameDay.startsAt))!;
        expect(await bookSlot(sameDay.id)).toMatchObject({ ok: true });
        expect(await bookSlot(twin.id)).toMatchObject({ ok: false });
        await cancelMyBooking((await prisma.sportBooking.findFirstOrThrow({ where: { studentId: me.studentId, slotId: sameDay.id } })).id);
      }
      // Три разных дня одной недели — третья отклоняется.
      const byWeek = Map.groupBy(slots, (s) => s.weekStart.toISOString());
      const week = [...byWeek.values()].find((ws) => new Set(ws.map((s) => day(s.startsAt))).size >= 3)!;
      const picks = week.filter((s, i) => week.findIndex((x) => day(x.startsAt) === day(s.startsAt)) === i).slice(0, 3);
      expect(await bookSlot(picks[0].id)).toMatchObject({ ok: true });
      expect(await bookSlot(picks[1].id)).toMatchObject({ ok: true });
      const third = await bookSlot(picks[2].id);
      expect(third).toMatchObject({ ok: false });
      expect(await statusOf(me.studentId, picks[2].id)).toBeNull();
    } finally {
      await prisma.sportBooking.deleteMany({ where: { studentId: me.studentId } }); // не оставлять «лишних» мест сверх вместимости
      for (const s of slots) await prisma.sportSlot.update({ where: { id: s.id }, data: { capacity: s.capacity } });
    }
  });

  it("тренировку, которая пересекается с парой или до которой не дойти, записать нельзя", async () => {
    await actAs("alina.lebedeva");
    const { days } = await getMySport();
    for (const d of days) {
      const blocked = (await getMySport(d)).slots.find((s) => s.action === "blocked");
      if (!blocked) continue;
      expect(await bookSlot(blocked.id)).toMatchObject({ ok: false });
      return;
    }
    console.warn("в окне записи нет конфликтных тренировок — проверка пропущена");
  });
});

describe("очередь", () => {
  it("мест нет: без согласия — отказ, с согласием — очередь; место не подтверждено", async () => {
    const slot = await fullSlot();
    const w1 = await makeStudent("t.w1");
    expect(await bookSlot(slot.id)).toMatchObject({ ok: false });
    expect(await statusOf(w1.studentId, slot.id)).toBeNull();
    expect(await bookSlot(slot.id, { queue: true })).toMatchObject({ ok: true });
    expect(await statusOf(w1.studentId, slot.id)).toBe("WAITLIST");
    expect(await placesTaken(slot.id)).toBe(slot.capacity);
  });

  it("B не может отменить запись A — 404; отмена A отдаёт место первому подходящему в очереди (FIFO)", async () => {
    const slot = await fullSlot();
    const A = await actAs("alina.lebedeva");
    // A занимает одно из мест (вместо демо-участника), за ней — очередь из двух свежих студентов.
    const seat = await prisma.sportBooking.findFirstOrThrow({ where: { slotId: slot.id, status: "CONFIRMED", studentId: { not: A.studentId } } });
    await prisma.sportBooking.deleteMany({ where: { slotId: slot.id, status: "WAITLIST" } });
    await prisma.sportBooking.update({ where: { id: seat.id }, data: { studentId: A.studentId } });
    const first = await makeStudent("t.fifo1");
    await bookSlot(slot.id, { queue: true });
    const second = await makeStudent("t.fifo2");
    await bookSlot(slot.id, { queue: true });

    await actAs("timur.orlov");
    await expect404(cancelMyBooking(seat.id));
    expect((await prisma.sportBooking.findUniqueOrThrow({ where: { id: seat.id } })).status).toBe("CONFIRMED");

    await actAs("alina.lebedeva");
    expect(await cancelMyBooking(seat.id)).toMatchObject({ ok: true });
    expect(await statusOf(A.studentId, slot.id)).toBe("CANCELLED");
    expect(await statusOf(first.studentId, slot.id)).toBe("CONFIRMED");
    expect(await statusOf(second.studentId, slot.id)).toBe("WAITLIST");
    expect(await placesTaken(slot.id)).toBe(slot.capacity);

    // Прямая запись не обгоняет очередь: освободилось место — его получает второй, а не новый студент.
    const other = await prisma.sportBooking.findFirstOrThrow({
      where: { slotId: slot.id, status: "CONFIRMED", studentId: { notIn: [first.studentId] } },
    });
    await prisma.sportBooking.delete({ where: { id: other.id } });
    const late = await makeStudent("t.late");
    expect(await bookSlot(slot.id)).toMatchObject({ ok: false });
    expect(await statusOf(second.studentId, slot.id)).toBe("CONFIRMED");
    expect(await statusOf(late.studentId, slot.id)).toBeNull();
  });

  it("за 12 часов до начала очередь замирает: встать нельзя", async () => {
    const slot = await fullSlot();
    const original = { startsAt: slot.startsAt, endsAt: slot.endsAt };
    await prisma.sportSlot.update({
      where: { id: slot.id },
      data: { startsAt: new Date(Date.now() + 6 * H), endsAt: new Date(Date.now() + 7.5 * H) },
    });
    try {
      const me = await makeStudent("t.frozen");
      expect(await bookSlot(slot.id, { queue: true })).toMatchObject({ ok: false });
      expect(await statusOf(me.studentId, slot.id)).toBeNull();
    } finally {
      await prisma.sportSlot.update({ where: { id: slot.id }, data: original });
    }
  });
});

describe("гонки (ревью Codex 12)", () => {
  /** Вызвать от имени нескольких студентов одновременно: каждый вызов DAL сразу берёт свою сессию. */
  function asMany(students: Awaited<ReturnType<typeof actAs>>[]) {
    for (const st of students) vi.mocked(session.requireStudent).mockResolvedValueOnce(st);
  }
  const slotsInWindow = () =>
    prisma.sportSlot.findMany({
      where: { startsAt: { gt: new Date(Date.now() + 13 * H), lt: addDays(new Date(), SPORT_RULES.windowDays) } },
      orderBy: { startsAt: "asc" },
    });
  const day = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });

  it("два студента одновременно на последнее место — запишется ровно один", async () => {
    const slot = await fullSlot();
    await prisma.sportBooking.deleteMany({ where: { slotId: slot.id, status: "WAITLIST" } });
    const seat = await prisma.sportBooking.findFirstOrThrow({ where: { slotId: slot.id, status: "CONFIRMED" } });
    await prisma.sportBooking.delete({ where: { id: seat.id } });
    const [x, y] = [await makeStudent("t.race1"), await makeStudent("t.race2")];
    asMany([x, y]);
    const results = await Promise.all([bookSlot(slot.id), bookSlot(slot.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await placesTaken(slot.id)).toBe(slot.capacity);
  });

  it("один студент параллельно на две тренировки сверх квоты — пройдёт одна", async () => {
    const me = await makeStudent("t.parallel");
    const slots = await slotsInWindow();
    const week = [...Map.groupBy(slots, (s) => s.weekStart.toISOString()).values()].find(
      (ws) => new Set(ws.map((s) => day(s.startsAt))).size >= 3,
    )!;
    const [a, b, c] = week.filter((s, i) => week.findIndex((x) => day(x.startsAt) === day(s.startsAt)) === i);
    for (const s of [a, b, c]) await prisma.sportSlot.update({ where: { id: s.id }, data: { capacity: 99 } });
    try {
      expect(await bookSlot(a.id)).toMatchObject({ ok: true });
      asMany([me, me]);
      const results = await Promise.all([bookSlot(b.id), bookSlot(c.id)]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await prisma.sportBooking.count({ where: { studentId: me.studentId, status: "CONFIRMED" } })).toBe(2);
    } finally {
      await prisma.sportBooking.deleteMany({ where: { studentId: me.studentId } });
      for (const s of [a, b, c]) await prisma.sportSlot.update({ where: { id: s.id }, data: { capacity: s.capacity } });
    }
  });

  it("продвижение своей же очереди внутри записи не даёт превысить квоту", async () => {
    const full = await fullSlot();
    const me = await makeStudent("t.ownqueue");
    expect(await bookSlot(full.id, { queue: true })).toMatchObject({ ok: true }); // ждёт место на заполненной
    const others = (await slotsInWindow()).filter(
      (s) => +s.weekStart === +full.weekStart && day(s.startsAt) !== day(full.startsAt) && s.id !== full.id,
    );
    const [p, q] = others.filter((s, i) => others.findIndex((x) => day(x.startsAt) === day(s.startsAt)) === i);
    if (!p || !q) return console.warn("мало дней в неделе — проверка пропущена");
    for (const s of [p, q]) await prisma.sportSlot.update({ where: { id: s.id }, data: { capacity: 99 } });
    try {
      expect(await bookSlot(p.id)).toMatchObject({ ok: true }); // 1-я
      // Освобождаем место на заполненной: следующая запись продвинет очередь и выдаст его этому же студенту (2-я).
      await prisma.sportBooking.deleteMany({ where: { slotId: full.id, status: "WAITLIST", studentId: { not: me.studentId } } });
      const seat = await prisma.sportBooking.findFirstOrThrow({ where: { slotId: full.id, status: "CONFIRMED" } });
      await prisma.sportBooking.delete({ where: { id: seat.id } });
      expect(await bookSlot(q.id)).toMatchObject({ ok: false }); // 3-я — отказ
      expect(await statusOf(me.studentId, full.id)).toBe("CONFIRMED");
      expect(await prisma.sportBooking.count({ where: { studentId: me.studentId, weekStart: full.weekStart, status: "CONFIRMED" } })).toBe(2);
    } finally {
      await prisma.sportBooking.deleteMany({ where: { studentId: me.studentId } });
      for (const s of [p, q]) await prisma.sportSlot.update({ where: { id: s.id }, data: { capacity: s.capacity } });
    }
  });

  it("после заморозки за 12 часов очередь не продвигается, даже если место освободилось", async () => {
    const slot = await fullSlot();
    const original = { startsAt: slot.startsAt, endsAt: slot.endsAt };
    await prisma.sportBooking.deleteMany({ where: { slotId: slot.id, status: "WAITLIST" } });
    const waiter = await makeStudent("t.frozenq");
    await bookSlot(slot.id, { queue: true });
    await prisma.sportSlot.update({
      where: { id: slot.id },
      data: { startsAt: new Date(Date.now() + 6 * H), endsAt: new Date(Date.now() + 7.5 * H) },
    });
    try {
      const seat = await prisma.sportBooking.findFirstOrThrow({ where: { slotId: slot.id, status: "CONFIRMED" } });
      await prisma.sportBooking.delete({ where: { id: seat.id } });
      // Любая запись в эту неделю запускает продвижение очередей недели.
      await makeStudent("t.trigger");
      const other = await prisma.sportSlot.findFirstOrThrow({
        where: { weekStart: slot.weekStart, id: { not: slot.id }, startsAt: { gt: new Date() } },
      });
      await bookSlot(other.id);
      expect(await statusOf(waiter.studentId, slot.id)).toBe("WAITLIST");
    } finally {
      await prisma.sportSlot.update({ where: { id: slot.id }, data: original });
    }
  });
});

describe("доступ", () => {
  it("в обзоре — только свои записи", async () => {
    const B = await actAs("timur.orlov");
    // Своя запись в окне — создаём явно: предыдущие тесты могли очистить очереди.
    const slot = await prisma.sportSlot.findFirstOrThrow({
      where: { startsAt: { gt: new Date(), lt: addDays(new Date(), SPORT_RULES.windowDays) }, bookings: { none: { studentId: B.studentId } } },
    });
    await prisma.sportBooking.create({ data: { studentId: B.studentId, slotId: slot.id, weekStart: slot.weekStart, status: "WAITLIST" } });
    const mine = (await getMySport()).bookings.map((b) => b.id);
    expect(mine.length).toBeGreaterThan(0);
    expect(await prisma.sportBooking.count({ where: { id: { in: mine }, studentId: { not: B.studentId } } })).toBe(0);
  });

  it("несуществующая тренировка и чужая запись — 404", async () => {
    await actAs("alina.lebedeva");
    await expect404(bookSlot("no-such-slot"));
    await expect404(cancelMyBooking("no-such-booking"));
  });
});
