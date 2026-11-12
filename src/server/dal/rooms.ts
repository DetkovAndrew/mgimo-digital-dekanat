import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { PLANS, planFor } from "@/lib/campus/plans";
import { ROOM_RULES, roomDayKeys, slotStarts } from "@/lib/campus/rules";
import { addDays, mskDayKey } from "@/lib/format";
import { prisma } from "../db";
import { requireStudent } from "../session";

// Аудитории и брони (docs/plans/rooms.md, ревью Codex 18).
// Расписание аудитории — публичный справочник для вошедших студентов (как у преподавателя): время, дисциплина,
// тип, код группы, статус; чужие пары — без id, чужие брони — только интервал «занято», без студента и цели.

type Tx = Prisma.TransactionClient;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const dayStart = (key: string) => new Date(`${key}T00:00:00+03:00`);
const at = (key: string, hhmm: string) => new Date(`${key}T${hhmm}:00+03:00`);

/** Корпуса со схемами: для выбора на /rooms. */
export async function listCampus() {
  await requireStudent();
  const buildings = await prisma.building.findMany({
    where: { id: { in: PLANS.map((p) => p.buildingId) } },
    select: { id: true, title: true, address: true, metro: true, _count: { select: { rooms: { where: { bookable: true } } } } },
  });
  return PLANS.map((p) => {
    const b = buildings.find((x) => x.id === p.buildingId)!;
    return { id: b.id, title: b.title, address: b.address, metro: b.metro, short: p.short, floors: p.floors, wings: p.wings.length, bookable: b._count.rooms };
  });
}

/** Состояние аудиторий корпуса на день: занята сейчас, есть ли моя бронь. Для раскраски схемы. */
export async function getCampusState(buildingId: string, day: string) {
  const { studentId } = await requireStudent();
  const plan = planFor(buildingId);
  if (!plan) notFound();
  const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { id: true, title: true, address: true } });
  if (!building) notFound();
  const now = new Date();
  const from = dayStart(day);
  const to = addDays(from, 1);
  const [lessonsNow, bookingsNow, mine] = await Promise.all([
    prisma.lesson.findMany({
      where: { roomRef: { buildingId }, status: { not: "CANCELLED" }, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { roomId: true },
    }),
    prisma.roomBooking.findMany({ where: { room: { buildingId }, status: "CONFIRMED", startsAt: { lte: now }, endsAt: { gt: now } }, select: { roomId: true } }),
    prisma.roomBooking.findMany({
      where: { studentId, room: { buildingId }, status: "CONFIRMED", startsAt: { gte: from, lt: to } },
      select: { roomId: true },
    }),
  ]);
  return {
    building,
    plan,
    busyNow: [...new Set([...lessonsNow.map((l) => l.roomId!), ...bookingsNow.map((b) => b.roomId)])],
    mine: [...new Set(mine.map((b) => b.roomId))],
  };
}

/** Публичное расписание аудитории на день + мои брони + свободные начала для брони. */
export async function getRoomDay(roomId: string, day: string) {
  const { studentId, groupId } = await requireStudent();
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, number: true, wing: true, floor: true, kind: true, capacity: true, bookable: true, title: true, buildingId: true },
  });
  if (!room) notFound();
  const from = dayStart(day);
  const to = addDays(from, 1);
  const [lessons, bookings] = await Promise.all([
    prisma.lesson.findMany({
      where: { roomId, startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        kind: true,
        startsAt: true,
        endsAt: true,
        status: true,
        offering: { select: { groupId: true, group: { select: { code: true } }, discipline: { select: { title: true } } } },
      },
    }),
    prisma.roomBooking.findMany({
      where: { roomId, status: "CONFIRMED", startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      select: { id: true, studentId: true, startsAt: true, endsAt: true, purpose: true },
    }),
  ]);

  const items = [
    ...lessons.map((l) => {
      const mine = l.offering.groupId === groupId;
      return {
        type: "lesson" as const,
        key: `l-${l.startsAt.getTime()}-${l.offering.group.code}`,
        lessonId: mine ? l.id : null,
        mine,
        startsAt: l.startsAt,
        endsAt: l.endsAt,
        kind: l.kind,
        status: l.status,
        title: l.offering.discipline.title,
        group: l.offering.group.code,
      };
    }),
    ...bookings.map((b) =>
      b.studentId === studentId
        ? { type: "booking" as const, key: `b-${b.id}`, bookingId: b.id as string | null, mine: true, startsAt: b.startsAt, endsAt: b.endsAt, purpose: b.purpose as string | null }
        : { type: "booking" as const, key: `b-${b.startsAt.getTime()}`, bookingId: null, mine: false, startsAt: b.startsAt, endsAt: b.endsAt, purpose: null },
    ),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const busy = items.filter((i) => i.type === "booking" || i.status !== "CANCELLED").map((i) => ({ from: i.startsAt, to: i.endsAt }));
  return { room, day, items, free: room.bookable ? slotStarts(day, busy, new Date()) : [] };
}

export type RoomDay = Awaited<ReturnType<typeof getRoomDay>>;

/** Мои брони: сегодняшние и будущие. */
export async function listMyRoomBookings() {
  const { studentId } = await requireStudent();
  return prisma.roomBooking.findMany({
    where: { studentId, status: "CONFIRMED", endsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      purpose: true,
      room: { select: { id: true, number: true, title: true, kind: true, buildingId: true, building: { select: { title: true } } } },
    },
  });
}

export type RoomActionResult = { ok: true; message: string } | { ok: false; error: string };

const BookInput = z.object({
  roomId: z.string().min(1).max(64),
  day: z.iso.date(),
  start: z.string().regex(HHMM),
  minutes: z.coerce.number().int(),
  purpose: z.string().trim().min(2, "Напишите цель: минимум 2 символа").max(ROOM_RULES.purposeMax, `Не длиннее ${ROOM_RULES.purposeMax} символов`),
});

/** Почему нельзя забронировать интервал (без учёта занятости аудитории). Время — МСК. */
export function intervalProblem(day: string, start: string, minutes: number, now = new Date()): string | null {
  if (!roomDayKeys(now).includes(day)) return `Бронировать можно на ${ROOM_RULES.windowDays} дней вперёд`;
  if (!HHMM.test(start)) return "Неверное время начала";
  const [, m] = start.split(":").map(Number);
  if (m % ROOM_RULES.stepMin !== 0) return "Начало — с шагом 30 минут";
  if (minutes < ROOM_RULES.minMinutes || minutes > ROOM_RULES.maxMinutes || minutes % ROOM_RULES.stepMin) return "Длительность — от 30 минут до 3 часов, шагом 30 минут";
  const from = at(day, start);
  const to = new Date(from.getTime() + minutes * 60_000);
  if (from < at(day, ROOM_RULES.opens) || to > at(day, ROOM_RULES.closes)) return `Аудитории открыты с ${ROOM_RULES.opens} до ${ROOM_RULES.closes}`;
  if (from <= now) return "Это время уже прошло";
  if (from.getTime() - now.getTime() > ROOM_RULES.windowDays * 86_400_000) return `Бронировать можно на ${ROOM_RULES.windowDays} дней вперёд`;
  return null;
}

/**
 * Забронировать. Порядок блокировок всегда «студент → аудитория»: квоты студента и пересечения в аудитории
 * проверяются внутри одной транзакции, параллельные запросы выстраиваются в очередь (ревью Codex 18).
 */
export async function bookRoom(input: unknown): Promise<RoomActionResult> {
  const { studentId } = await requireStudent();
  const parsed = BookInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте данные брони" };
  const { roomId, day, start, minutes, purpose } = parsed.data;
  const now = new Date();
  const problem = intervalProblem(day, start, minutes, now);
  if (problem) return { ok: false, error: problem };
  const from = at(day, start);
  const to = new Date(from.getTime() + minutes * 60_000);

  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { bookable: true } });
  if (!room) notFound();
  if (!room.bookable) return { ok: false, error: "Эту аудиторию бронирует только деканат" };

  return prisma.$transaction(async (tx: Tx) => {
    await tx.$queryRaw`SELECT 1 FROM "student_profile" WHERE "id" = ${studentId} FOR UPDATE`;
    await tx.$queryRaw`SELECT 1 FROM "room" WHERE "id" = ${roomId} FOR UPDATE`;
    // После ожидания блокировок: аудиторию могли сделать небронируемой, а время — пройти.
    const fresh = await tx.room.findUnique({ where: { id: roomId }, select: { bookable: true } });
    if (!fresh?.bookable) return { ok: false as const, error: "Эту аудиторию бронирует только деканат" };
    const late = intervalProblem(day, start, minutes, new Date());
    if (late) return { ok: false as const, error: late };

    const active = await tx.roomBooking.count({ where: { studentId, status: "CONFIRMED", endsAt: { gt: now } } });
    if (active >= ROOM_RULES.maxActive) return { ok: false as const, error: `Не больше ${ROOM_RULES.maxActive} активных броней: отмените одну из своих` };
    const sameDay = await tx.roomBooking.count({ where: { studentId, status: "CONFIRMED", startsAt: { gte: dayStart(day), lt: addDays(dayStart(day), 1) } } });
    if (sameDay >= ROOM_RULES.maxPerDay) return { ok: false as const, error: "На этот день у вас уже есть бронь" };

    const overlap = { startsAt: { lt: to }, endsAt: { gt: from } };
    const lesson = await tx.lesson.count({ where: { roomId, status: { not: "CANCELLED" }, ...overlap } });
    if (lesson) return { ok: false as const, error: "В это время в аудитории занятие" };
    const taken = await tx.roomBooking.count({ where: { roomId, status: "CONFIRMED", ...overlap } });
    if (taken) return { ok: false as const, error: "Это время только что заняли, выберите другое" };

    await tx.roomBooking.create({ data: { roomId, studentId, startsAt: from, endsAt: to, purpose } });
    return { ok: true as const, message: `Забронировано: ${day.split("-").reverse().slice(0, 2).join(".")}, ${start}` };
  });
}

/** Отменить свою бронь до её окончания. Чужая или несуществующая — 404. */
export async function cancelMyRoomBooking(id: string): Promise<RoomActionResult> {
  const { studentId } = await requireStudent();
  const res = await prisma.roomBooking.updateMany({
    where: { id, studentId, status: "CONFIRMED", endsAt: { gt: new Date() } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (!res.count) notFound();
  return { ok: true, message: "Бронь отменена" };
}

/** Ключ дня по умолчанию — сегодня (МСК). */
export const todayKey = () => mskDayKey(new Date());

/** Свободное время бронируемых аудиторий на несколько дней (для помощника): интервалы «с–до» по дням. */
export async function bookableFreeRanges(dayCount: number, now = new Date()) {
  await requireStudent();
  const days = roomDayKeys(now).slice(0, dayCount);
  const from = dayStart(days[0]);
  const to = addDays(dayStart(days.at(-1)!), 1);
  const rooms = await prisma.room.findMany({
    where: { bookable: true },
    orderBy: [{ buildingId: "asc" }, { number: "asc" }],
    select: { id: true, number: true, kind: true, capacity: true, title: true, buildingId: true, building: { select: { title: true } } },
  });
  const ids = rooms.map((r) => r.id);
  const [lessons, bookings] = await Promise.all([
    prisma.lesson.findMany({ where: { roomId: { in: ids }, status: { not: "CANCELLED" }, startsAt: { lt: to }, endsAt: { gt: from } }, select: { roomId: true, startsAt: true, endsAt: true } }),
    prisma.roomBooking.findMany({ where: { roomId: { in: ids }, status: "CONFIRMED", startsAt: { lt: to }, endsAt: { gt: from } }, select: { roomId: true, startsAt: true, endsAt: true } }),
  ]);
  return rooms.map((r) => {
    const busy = [...lessons, ...bookings].filter((x) => x.roomId === r.id).map((x) => ({ from: x.startsAt, to: x.endsAt }));
    return { ...r, days: days.map((d) => ({ day: d, ranges: toRanges(slotStarts(d, busy, now)) })) };
  });
}

/** Свободные начала → интервалы «10:00–12:30». */
function toRanges(starts: { start: string; max: number }[]) {
  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out: [number, number][] = [];
  for (const s of starts) {
    const a = min(s.start);
    const b = a + ROOM_RULES.stepMin;
    const last = out.at(-1);
    if (last && last[1] >= a) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => `${fmt(a)}–${fmt(b)}`);
}

const FindInput = z.object({
  day: z.iso.date(),
  after: z.string().regex(HHMM).optional(),
  before: z.string().regex(HHMM).optional(),
  building: z.enum(PLANS.map((p) => p.buildingId) as [string, ...string[]]).optional(),
  kinds: z.array(z.enum(["COWORKING", "MEETING", "CLASSROOM"])).max(3).optional(),
  minMinutes: z.coerce.number().int().min(30).max(180).optional(),
});

/**
 * Функция помощника «найти свободные аудитории» (только чтение): точные свободные интервалы
 * бронируемых аудиторий в день, обрезанные по «после/до». Модель не считает интервалы сама — она путалась.
 */
export async function findFreeRooms(args: unknown, now = new Date()) {
  const parsed = FindInput.safeParse(args);
  if (!parsed.success) return { error: "Неверные параметры поиска" };
  const { day, after, before, building, kinds, minMinutes = 60 } = parsed.data;
  if (!roomDayKeys(now).includes(day)) return { error: `Бронировать можно только на ${ROOM_RULES.windowDays} дней вперёд` };
  const all = await bookableFreeRanges(ROOM_RULES.windowDays, now);
  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const lo = after ? min(after) : 0;
  const hi = before ? min(before) : 24 * 60;
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const rooms = all
    .filter((r) => (!building || r.buildingId === building) && (!kinds?.length || kinds.includes(r.kind as "COWORKING" | "MEETING" | "CLASSROOM")))
    .map((r) => {
      const ranges = (r.days.find((d) => d.day === day)?.ranges ?? [])
        .map((x) => x.split("–").map(min) as [number, number])
        // Обрезаем по сетке брони: начало и конец кратны 30 минутам, иначе интервал нельзя забронировать.
        .map(([a, b]) => [Math.ceil(Math.max(a, lo) / ROOM_RULES.stepMin) * ROOM_RULES.stepMin, Math.floor(Math.min(b, hi) / ROOM_RULES.stepMin) * ROOM_RULES.stepMin] as const)
        .filter(([a, b]) => b - a >= minMinutes)
        .map(([a, b]) => `${fmt(a)}–${fmt(b)}`);
      return { number: r.number, name: r.title ?? r.kind, kind: r.kind, building: r.building.title, capacity: r.capacity, free: ranges, link: `/rooms/${r.buildingId}?room=${r.number}&d=${day}` };
    })
    .filter((r) => r.free.length);
  return { day, after: after ?? null, before: before ?? null, rooms };
}
