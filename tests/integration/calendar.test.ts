// Календарь (docs/plans/calendar.md, ревью Codex 84): подписка по токену, файл и одно событие — доступ A/B,
// новая ссылка, смена секрета, в подписке нет свободного текста и результатов.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildCalendar } from "@/lib/calendar/ics";
import { addDays } from "@/lib/format";
import { prisma } from "@/server/db";
import { feedEvents, feedOwnerByToken, getMyCalendarFile, getMyEvent, getMyFeed, rotateMyFeed } from "@/server/dal/calendar";
import { actAs } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

type Who = Awaited<ReturnType<typeof actAs>>;
let A: Who;
let B: Who;
const cleanup: { rooms: string[]; sport: string[]; changes: string[] } = { rooms: [], sport: [], changes: [] };
const tokenOf = (url: string) => url.split("/feed/")[1];

beforeAll(async () => {
  B = await actAs("timur.orlov");
  A = await actAs("alina.lebedeva");
  await prisma.calendarFeed.deleteMany({ where: { studentId: { in: [A.studentId, B.studentId] } } });
});

afterAll(async () => {
  await prisma.roomBooking.deleteMany({ where: { id: { in: cleanup.rooms } } });
  await prisma.sportBooking.deleteMany({ where: { id: { in: cleanup.sport } } });
  await prisma.lessonChange.deleteMany({ where: { id: { in: cleanup.changes } } });
  await prisma.calendarFeed.deleteMany({ where: { studentId: { in: [A.studentId, B.studentId] } } });
  await prisma.$disconnect();
});

/** Бронь и тренировка студента в ближайшие дни — чтобы попасть в подписку и проверить чужие id. */
async function bookingsOf(who: Who, purpose: string) {
  const room = await prisma.room.findFirstOrThrow({ where: { bookable: true }, orderBy: { id: "asc" } });
  const start = addDays(new Date(), 3 + (who === A ? 0 : 1));
  const rb = await prisma.roomBooking.create({ data: { roomId: room.id, studentId: who.studentId, startsAt: start, endsAt: new Date(start.getTime() + 3_600_000), purpose } });
  cleanup.rooms.push(rb.id);
  const slot = await prisma.sportSlot.findFirstOrThrow({ where: { startsAt: { gt: new Date() }, bookings: { none: { studentId: who.studentId } } }, orderBy: { startsAt: "asc" } });
  const sb = await prisma.sportBooking.create({ data: { studentId: who.studentId, slotId: slot.id, weekStart: slot.weekStart, status: "CONFIRMED" } });
  cleanup.sport.push(sb.id);
  return { room: rb.id, sport: sb.id };
}

describe("подписка на календарь", () => {
  it("первый выпуск — одна запись даже при двух одновременных открытиях; токен в БД только хешем", async () => {
    await actAs("alina.lebedeva");
    const [x, y] = await Promise.all([getMyFeed(), getMyFeed()]);
    expect(x.https).toBe(y.https);
    expect(x.webcal.startsWith("webcal://")).toBe(true);
    const rows = await prisma.calendarFeed.findMany({ where: { studentId: A.studentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].tokenHash).not.toContain(tokenOf(x.https));
  });

  it("лента Алины — только её группа и её брони и тренировки; без причины переноса, цели брони и результатов", async () => {
    const mine = await bookingsOf(A, "Тайная цель брони Алины");
    const theirs = await bookingsOf(B, "Цель брони Тимура");
    // Перенос с причиной у пары группы Алины (как от деканата): в ленте только «Изменено», причины нет.
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { offering: { groupId: A.groupId }, startsAt: { gt: new Date() }, status: "SCHEDULED" }, orderBy: { startsAt: "asc" } });
    const ch = await prisma.lessonChange.create({
      data: { lessonId: lesson.id, previousStatus: "SCHEDULED", newStatus: "SCHEDULED", previousStartsAt: lesson.startsAt, previousEndsAt: lesson.endsAt, newStartsAt: lesson.startsAt, newEndsAt: lesson.endsAt, reason: "Секретная причина переноса" },
    });
    cleanup.changes.push(ch.id);
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "RESCHEDULED" } });

    await actAs("alina.lebedeva");
    const owner = await feedOwnerByToken(tokenOf((await getMyFeed()).https));
    expect(owner).toEqual({ studentId: A.studentId, groupId: A.groupId });
    const events = await feedEvents(owner!);
    const uids = events.map((e) => e.uid);
    expect(uids).toContain(`room-${mine.room}@university-dekanat`);
    expect(uids).toContain(`sport-${mine.sport}@university-dekanat`);
    expect(uids).not.toContain(`room-${theirs.room}@university-dekanat`);
    expect(uids).not.toContain(`sport-${theirs.sport}@university-dekanat`);
    const foreignLessons = await prisma.lesson.findMany({ where: { offering: { groupId: B.groupId } }, select: { id: true } });
    expect(foreignLessons.some((l) => uids.includes(`lesson-${l.id}@university-dekanat`))).toBe(false);
    const changed = events.find((e) => e.uid === `lesson-${lesson.id}@university-dekanat`)!;
    expect(changed.summary.startsWith("Изменено · ")).toBe(true);
    const text = buildCalendar(events, { name: "x", feed: true });
    for (const secret of ["Секретная причина переноса", "Тайная цель брони Алины", "сдано", "балл"]) expect(text).not.toContain(secret);
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "SCHEDULED" } });

    // По сессии (файл) причина и цель брони — есть: это сам владелец.
    const file = buildCalendar(await getMyCalendarFile("term"), { name: "x" });
    expect(file).toContain("Тайная цель брони Алины");
  });

  it("новая ссылка: старый токен — null; вторая подряд — отказ; чужую ленту не трогает", async () => {
    await actAs("timur.orlov");
    const timur = tokenOf((await getMyFeed()).https);
    await actAs("alina.lebedeva");
    const old = tokenOf((await getMyFeed()).https);
    await prisma.calendarFeed.update({ where: { studentId: A.studentId }, data: { rotatedAt: new Date(Date.now() - 120_000) } });
    const [r1, r2] = await Promise.all([rotateMyFeed(), rotateMyFeed()]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
    expect(await feedOwnerByToken(old)).toBeNull();
    expect((await feedOwnerByToken(tokenOf((await getMyFeed()).https)))?.studentId).toBe(A.studentId);
    expect((await rotateMyFeed()).ok).toBe(false); // не чаще раза в минуту
    expect((await feedOwnerByToken(timur))?.studentId).toBe(B.studentId);
  });

  it("неверный формат и смена секрета сервера: null; открытие страницы выпускает новую ссылку", async () => {
    for (const bad of ["", "short", "x".repeat(43) + "/", 42, null]) expect(await feedOwnerByToken(bad)).toBeNull();
    await actAs("alina.lebedeva");
    const before = tokenOf((await getMyFeed()).https);
    const secret = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = `${secret}-rotated`;
    try {
      expect(await feedOwnerByToken(before)).toBeNull();
      const after = tokenOf((await getMyFeed()).https);
      expect(after).not.toBe(before);
      expect((await feedOwnerByToken(after))?.studentId).toBe(A.studentId);
    } finally {
      process.env.BETTER_AUTH_SECRET = secret;
    }
    await getMyFeed(); // вернуть хеш под исходный секрет
  });

  it("смена секрета и одновременная новая ссылка: восстановление хеша не перезаписывает ротацию (ревью Codex 85)", async () => {
    await actAs("alina.lebedeva");
    await getMyFeed();
    const secret = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = `${secret}-race`;
    try {
      for (let i = 0; i < 5; i++) {
        await prisma.calendarFeed.update({ where: { studentId: A.studentId }, data: { rotatedAt: new Date(Date.now() - 120_000), tokenHash: "0".repeat(64) } });
        await Promise.all([getMyFeed(), rotateMyFeed()]);
        const row = await prisma.calendarFeed.findUniqueOrThrow({ where: { studentId: A.studentId } });
        // Какой бы порядок ни выпал, после гонки версия и хеш уже согласованы: повторное открытие ничего не чинит,
        // а ссылка со страницы работает.
        const link = tokenOf((await getMyFeed()).https);
        expect((await prisma.calendarFeed.findUniqueOrThrow({ where: { studentId: A.studentId } })).tokenHash).toBe(row.tokenHash);
        expect((await feedOwnerByToken(link))?.studentId).toBe(A.studentId);
      }
    } finally {
      process.env.BETTER_AUTH_SECRET = secret;
    }
    await getMyFeed();
  });
});

describe("одно событие: только своё", () => {
  it("пара, аттестация, тренировка, бронь — свои находятся, чужие — null (404)", async () => {
    const theirs = await bookingsOf(B, "Бронь Тимура");
    const mine = await bookingsOf(A, "Бронь Алины");
    const [myLesson, theirLesson] = await Promise.all([
      prisma.lesson.findFirstOrThrow({ where: { offering: { groupId: A.groupId } } }),
      prisma.lesson.findFirstOrThrow({ where: { offering: { groupId: B.groupId } } }),
    ]);
    const [myAssessment, theirAssessment] = await Promise.all([
      prisma.assessment.findFirstOrThrow({ where: { offering: { groupId: A.groupId }, OR: [{ dueAt: { not: null } }, { scheduledAt: { not: null } }] } }),
      prisma.assessment.findFirstOrThrow({ where: { offering: { groupId: B.groupId }, OR: [{ dueAt: { not: null } }, { scheduledAt: { not: null } }] } }),
    ]);
    await actAs("alina.lebedeva");
    expect(await getMyEvent("lesson", myLesson.id)).not.toBeNull();
    expect(await getMyEvent("assessment", myAssessment.id)).not.toBeNull();
    expect(await getMyEvent("sport", mine.sport)).not.toBeNull();
    expect((await getMyEvent("room", mine.room))?.description).toContain("Бронь Алины");
    expect(await getMyEvent("lesson", theirLesson.id)).toBeNull();
    expect(await getMyEvent("assessment", theirAssessment.id)).toBeNull();
    expect(await getMyEvent("sport", theirs.sport)).toBeNull();
    expect(await getMyEvent("room", theirs.room)).toBeNull();
    // Неверный вид с чужим id тоже ничего не находит.
    expect(await getMyEvent("room", theirLesson.id)).toBeNull();
  });

  it("файл: неделя — не дольше 7 дней, семестр — не дальше 180 дней вперёд", async () => {
    await actAs("alina.lebedeva");
    const week = await getMyCalendarFile("week");
    const span = (list: { start: Date }[]) => (list.length ? list.at(-1)!.start.getTime() - list[0].start.getTime() : 0);
    expect(span(week)).toBeLessThan(7 * 86_400_000);
    const term = await getMyCalendarFile("term");
    expect(term.every((e) => e.start.getTime() < addDays(new Date(), 181).getTime())).toBe(true);
    expect(term.length).toBeGreaterThan(week.length);
  });
});
