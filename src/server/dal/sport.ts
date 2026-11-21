import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, formatDateTime, mskDayKey, mskStartOfDay } from "@/lib/format";
import { checkSlot, type BusyItem } from "@/lib/sport/availability";
import { prisma } from "../db";
import { requireStudent } from "../session";
import { pushAfterResponse } from "./push";

// Правила University (демо, docs/plans/sport-fcfs.md): «успел — записался».
// Тренировка = 5 баллов, минимум 60 за тренировки, всего 100; не больше 2 в неделю и 1 в день.
// Запись открывается за 7 суток; очередь замирает за 12 часов до начала.
export const SPORT_RULES = {
  pointsPerTraining: 5,
  trainingMin: 60,
  total: 100,
  weeklyQuota: 2,
  weeklyQueue: 2,
  windowDays: 7,
  queueFreezeHours: 12,
};
const TAKES_PLACE = ["CONFIRMED", "ATTENDED", "MISSED"] as const; // занимают место и квоту
// Порядок очереди: кто раньше встал; при равном времени — по id, одинаково для выдачи места и для «вы N-й».
const QUEUE_ORDER = [{ statusAt: "asc" }, { id: "asc" }] satisfies Prisma.SportBookingOrderByWithRelationInput[];

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const windowEnd = (now: Date) => addDays(now, SPORT_RULES.windowDays);
const queueOpen = (startsAt: Date, now: Date) => startsAt.getTime() - now.getTime() > SPORT_RULES.queueFreezeHours * 3_600_000;

/** Все изменения недели сериализуются блокировкой её строки. */
async function lockWeek(tx: Tx, weekStart: Date) {
  await tx.$queryRaw`SELECT 1 FROM "sport_week" WHERE "weekStart" = ${weekStart}::date FOR UPDATE`;
}

const slotSelect = {
  id: true,
  weekStart: true,
  startsAt: true,
  endsAt: true,
  room: true,
  coach: true,
  capacity: true,
  section: { select: { title: true } },
  building: { select: { id: true, title: true, lat: true, lon: true, metro: true } },
} satisfies Prisma.SportSlotSelect;
type Slot = Prisma.SportSlotGetPayload<{ select: typeof slotSelect }>;

/** Пары группы студента и его тренировки (кроме этого слота) в тот же московский день. */
async function busyOnDay(db: Db, studentId: string, slot: Slot): Promise<BusyItem[]> {
  const from = mskStartOfDay(slot.startsAt);
  const to = addDays(from, 1);
  const { groupId } = await db.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true } });
  const [lessons, trainings] = await Promise.all([
    db.lesson.findMany({
      where: { offering: { groupId }, status: { not: "CANCELLED" }, startsAt: { gte: from, lt: to } },
      select: {
        startsAt: true,
        endsAt: true,
        online: true,
        building: { select: { id: true, title: true, lat: true, lon: true } },
        offering: { select: { discipline: { select: { title: true, shortTitle: true } } } },
      },
    }),
    db.sportBooking.findMany({
      where: { studentId, status: { in: [...TAKES_PLACE] }, slotId: { not: slot.id }, slot: { startsAt: { gte: from, lt: to } } },
      select: { slot: { select: { startsAt: true, endsAt: true, section: { select: { title: true } }, building: true } } },
    }),
  ]);
  return [
    ...lessons.map((l) => ({
      title: l.offering.discipline.shortTitle ?? l.offering.discipline.title,
      startsAt: l.startsAt,
      endsAt: l.endsAt,
      place: l.online ? null : l.building,
    })),
    ...trainings.map((t) => ({
      title: `Физкультура: ${t.slot.section.title}`,
      startsAt: t.slot.startsAt,
      endsAt: t.slot.endsAt,
      place: t.slot.building,
    })),
  ];
}

/** Почему студенту нельзя на эту тренировку (квоты, пары, переходы); null — можно. */
async function blockedReason(db: Db, studentId: string, slot: Slot): Promise<string | null> {
  const inWeek = await db.sportBooking.count({
    where: { studentId, weekStart: slot.weekStart, status: { in: [...TAKES_PLACE] }, slotId: { not: slot.id } },
  });
  if (inWeek >= SPORT_RULES.weeklyQuota) return `на этой неделе у вас уже ${SPORT_RULES.weeklyQuota} тренировки`;
  const busy = await busyOnDay(db, studentId, slot);
  if (busy.some((b) => b.title.startsWith("Физкультура"))) return "в этот день у вас уже есть тренировка";
  return checkSlot({ startsAt: slot.startsAt, endsAt: slot.endsAt, place: slot.building }, busy)?.text ?? null;
}

const taken = (db: Db, slotId: string) => db.sportBooking.count({ where: { slotId, status: { in: [...TAKES_PLACE] } } });

// ─── Обзор для студента ──────────────────────────────────────────────────────

/** Дни, на которые сейчас открыта запись: с сегодняшнего по день, когда кончается окно 7×24 ч. */
export function bookingDays(now = new Date()) {
  const days: string[] = [];
  for (let d = mskStartOfDay(now); d < windowEnd(now); d = addDays(d, 1)) days.push(mskDayKey(d));
  return days;
}

export async function getMySport(dayParam?: string) {
  const { studentId } = await requireStudent();
  const now = new Date();

  const term = await prisma.academicTerm.findFirst({
    where: { startsOn: { lte: now } },
    orderBy: { startsOn: "desc" },
    select: { id: true, title: true, startsOn: true, endsOn: true },
  });
  const termFrom = term ? new Date(`${term.startsOn.toISOString().slice(0, 10)}T00:00:00+03:00`) : now;
  const termTo = term ? addDays(new Date(`${term.endsOn.toISOString().slice(0, 10)}T00:00:00+03:00`), 1) : now;

  const [attended, missed, extra, mine] = await Promise.all([
    prisma.sportBooking.count({ where: { studentId, status: "ATTENDED", slot: { startsAt: { gte: termFrom, lt: termTo } } } }),
    prisma.sportBooking.count({ where: { studentId, status: "MISSED", slot: { startsAt: { gte: termFrom, lt: termTo } } } }),
    term ? prisma.sportExtraPoints.findMany({ where: { studentId, termId: term.id }, select: { title: true, points: true, awardedAt: true } }) : [],
    prisma.sportBooking.findMany({
      where: { studentId, status: { in: ["CONFIRMED", "WAITLIST"] }, slot: { endsAt: { gt: now } } },
      orderBy: { slot: { startsAt: "asc" } },
      select: { id: true, status: true, statusAt: true, slot: { select: slotSelect } },
    }),
  ]);

  // Позиция в очереди — FIFO; для подтверждённых — актуальный конфликт (пару могли перенести после записи).
  const bookings = await Promise.all(
    mine.map(async (b) => {
      if (b.status === "WAITLIST") {
        const ahead = await prisma.sportBooking.count({
          where: {
            slotId: b.slot.id,
            status: "WAITLIST",
            OR: [{ statusAt: { lt: b.statusAt } }, { statusAt: b.statusAt, id: { lt: b.id } }],
          },
        });
        return { id: b.id, status: b.status, slot: b.slot, position: ahead + 1, frozen: !queueOpen(b.slot.startsAt, now), conflict: null };
      }
      const busy = await busyOnDay(prisma, studentId, b.slot);
      const conflict = checkSlot({ startsAt: b.slot.startsAt, endsAt: b.slot.endsAt, place: b.slot.building }, busy)?.text ?? null;
      return { id: b.id, status: b.status, slot: b.slot, position: null, frozen: false, conflict };
    }),
  );

  const days = bookingDays(now);
  const day = dayParam && days.includes(dayParam) ? dayParam : days[0];
  const dayFrom = new Date(`${day}T00:00:00+03:00`);
  const daySlots = await prisma.sportSlot.findMany({
    where: { startsAt: { gte: dayFrom > now ? dayFrom : now, lt: addDays(dayFrom, 1) } },
    orderBy: { startsAt: "asc" },
    select: {
      ...slotSelect,
      _count: { select: { bookings: { where: { status: { in: [...TAKES_PLACE] } } } } },
      bookings: { where: { status: "WAITLIST" }, select: { id: true } },
    },
  });
  const myBySlot = new Map(mine.map((b) => [b.slot.id, b.status]));
  const slots = await Promise.all(
    daySlots.map(async ({ _count, bookings: queue, ...s }) => {
      const free = Math.max(0, s.capacity - _count.bookings);
      const my = myBySlot.get(s.id) ?? null;
      const inWindow = s.startsAt <= windowEnd(now);
      const reason = my || !inWindow ? null : await blockedReason(prisma, studentId, s);
      const action: "booked" | "queued" | "book" | "queue" | "blocked" | "closed" =
        my === "CONFIRMED"
          ? "booked"
          : my === "WAITLIST"
            ? "queued"
            : !inWindow
              ? "closed"
              : reason
                ? "blocked"
                : free > 0
                  ? "book"
                  : queueOpen(s.startsAt, now)
                    ? "queue"
                    : "closed";
      return {
        ...s,
        free,
        queue: queue.length,
        action,
        note: reason ?? (action === "closed" ? (inWindow ? `очередь закрыта за ${SPORT_RULES.queueFreezeHours} ч до начала` : "запись ещё не открылась") : null),
      };
    }),
  );

  const trainingPoints = attended * SPORT_RULES.pointsPerTraining;
  const extraPoints = extra.reduce((s, e) => s + e.points, 0);
  return {
    term: term?.title ?? null,
    rules: SPORT_RULES,
    progress: {
      attended,
      missed,
      trainingPoints,
      extraPoints,
      extra,
      total: Math.min(SPORT_RULES.total, trainingPoints + extraPoints),
      trainingsNeeded: Math.max(0, Math.ceil((SPORT_RULES.trainingMin - trainingPoints) / SPORT_RULES.pointsPerTraining)),
    },
    bookings,
    days,
    day,
    slots,
  };
}

export type MySport = Awaited<ReturnType<typeof getMySport>>;

// ─── Запись, очередь, отмена ────────────────────────────────────────────────

export type SportActionResult = { ok: true; message: string } | { ok: false; error: string };

async function lockedSlot<T>(slotId: string, run: (tx: Tx, slot: Slot) => Promise<T>) {
  const found = await prisma.sportSlot.findUnique({ where: { id: slotId }, select: { weekStart: true } });
  if (!found) notFound();
  return prisma.$transaction(async (tx) => {
    await lockWeek(tx, found.weekStart);
    return run(tx, await tx.sportSlot.findUniqueOrThrow({ where: { id: slotId }, select: slotSelect }));
  });
}

/**
 * Записаться: место выдаётся сразу, если оно есть и нет конфликта.
 * Если мест нет — с `queue: true` студент встаёт в очередь (место не подтверждено).
 */
export async function bookSlot(slotId: string, { queue = false } = {}): Promise<SportActionResult> {
  const { studentId } = await requireStudent();
  const pushIds: string[] = []; // места из очереди — уведомления на телефон после коммита
  const result = await lockedSlot<SportActionResult>(slotId, async (tx, slot) => {
    const now = new Date();
    if (slot.startsAt <= now) return { ok: false, error: "Тренировка уже началась" };
    if (slot.startsAt > windowEnd(now)) return { ok: false, error: `Запись откроется ${formatDateTime(addDays(slot.startsAt, -SPORT_RULES.windowDays))}` };

    const existing = await tx.sportBooking.findUnique({ where: { studentId_slotId: { studentId, slotId } }, select: { status: true } });
    if (existing?.status === "CONFIRMED") return { ok: true, message: "Вы уже записаны" };
    if (existing?.status === "WAITLIST") return { ok: true, message: "Вы уже в очереди" };

    // Сначала очередь: прямая запись не обгоняет тех, кто ждёт и подходит. Проверять студента —
    // уже после продвижения: оно могло выдать ему место из его же очереди (ревью Codex 12).
    await promoteWeek(tx, slot.weekStart, now, pushIds);
    const reason = await blockedReason(tx, studentId, slot);
    if (reason) return { ok: false, error: `Нельзя: ${reason}` };
    const save = (status: "CONFIRMED" | "WAITLIST") =>
      tx.sportBooking.upsert({
        where: { studentId_slotId: { studentId, slotId } },
        update: { status, statusAt: now },
        create: { studentId, slotId, weekStart: slot.weekStart, status, statusAt: now },
      });

    if ((await taken(tx, slotId)) < slot.capacity) {
      await save("CONFIRMED");
      return { ok: true, message: "Вы записаны — тренировка в расписании" };
    }
    if (!queue) return { ok: false, error: "Места только что закончились — можно встать в очередь" };
    if (!queueOpen(slot.startsAt, now)) return { ok: false, error: "Мест нет, а очередь закрывается за 12 часов до начала" };
    const queued = await tx.sportBooking.count({
      where: { studentId, weekStart: slot.weekStart, status: "WAITLIST", slot: { startsAt: { gt: now } } },
    });
    if (queued >= SPORT_RULES.weeklyQueue) return { ok: false, error: `В очереди можно стоять не больше чем на ${SPORT_RULES.weeklyQueue} тренировки в неделю` };
    await save("WAITLIST");
    return { ok: true, message: "Вы в очереди. Место пока не подтверждено — пришлём уведомление" };
  });
  pushIds.forEach(pushAfterResponse);
  return result;
}

/** Отменить запись или выйти из очереди до начала. Освободившееся место — первому подходящему в очереди. */
export async function cancelMyBooking(bookingId: string): Promise<SportActionResult> {
  const { studentId } = await requireStudent();
  const own = await prisma.sportBooking.findFirst({ where: { id: bookingId, studentId }, select: { slotId: true } });
  if (!own) notFound();
  const pushIds: string[] = [];
  const result = await lockedSlot<SportActionResult>(own.slotId, async (tx, slot) => {
    const now = new Date();
    const b = await tx.sportBooking.findFirst({ where: { id: bookingId, studentId }, select: { status: true } });
    if (!b) notFound();
    if (slot.startsAt <= now) return { ok: false, error: "Тренировка уже началась — отменить нельзя" };
    if (b.status !== "CONFIRMED" && b.status !== "WAITLIST") return { ok: false, error: "Эту запись уже нельзя отменить" };

    await tx.sportBooking.update({ where: { id: bookingId }, data: { status: "CANCELLED", statusAt: now } });
    if (b.status === "WAITLIST") return { ok: true, message: "Вы вышли из очереди" };
    // Освободились место и квота — пересматриваем очереди всей недели.
    const promoted = await promoteWeek(tx, slot.weekStart, now, pushIds);
    return { ok: true, message: promoted ? "Запись отменена, место перешло следующему в очереди" : "Запись отменена" };
  });
  pushIds.forEach(pushAfterResponse);
  return result;
}

/** Продвигает очереди недели (FIFO, с повторной проверкой). Вызывать под блокировкой недели. */
async function promoteWeek(tx: Tx, weekStart: Date, now: Date, pushIds: string[]) {
  let promoted = 0;
  for (let changed = true; changed; ) {
    changed = false;
    const slots = await tx.sportSlot.findMany({
      where: {
        weekStart,
        startsAt: { gt: addDays(now, SPORT_RULES.queueFreezeHours / 24) },
        bookings: { some: { status: "WAITLIST" } },
      },
      orderBy: { startsAt: "asc" },
      select: slotSelect,
    });
    for (const slot of slots) {
      let free = slot.capacity - (await taken(tx, slot.id));
      if (free <= 0) continue;
      const waiting = await tx.sportBooking.findMany({
        where: { slotId: slot.id, status: "WAITLIST" },
        orderBy: QUEUE_ORDER,
        select: { id: true, studentId: true, student: { select: { userId: true, user: { select: { accounts: { select: { id: true }, take: 1 } } } } } },
      });
      for (const w of waiting) {
        if (free <= 0) break;
        if (await blockedReason(tx, w.studentId, slot)) continue; // не подходит сейчас — остаётся в очереди
        await tx.sportBooking.update({ where: { id: w.id }, data: { status: "CONFIRMED", statusAt: now } });
        if (w.student.user.accounts.length) {
          const created = await tx.notification.create({
            select: { id: true },
            data: {
              kind: "ANNOUNCEMENT",
              title: `Освободилось место: ${slot.section.title}`,
              body: `Вы записаны из очереди на ${formatDateTime(slot.startsAt)}. Тренировка уже в расписании.`,
              important: true,
              recipients: { create: { userId: w.student.userId } },
            },
          });
          pushIds.push(created.id);
        }
        free--;
        promoted++;
        changed = true;
      }
    }
  }
  return promoted;
}
