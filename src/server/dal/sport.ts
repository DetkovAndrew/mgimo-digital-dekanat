import "server-only";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, mskDayKey, mskWeekStart } from "@/lib/format";
import { allocate } from "@/lib/sport/allocate";
import { checkSlot, shortReason, type BusyItem, type Unavailable } from "@/lib/sport/availability";
import { prisma } from "../db";
import { requireStudent } from "../session";

// Правила University (демо): тренировка = 5 баллов, минимум 60 за тренировки, всего 100,
// не больше 2 тренировок в неделю, до 6 приоритетов на неделю.
export const SPORT_RULES = { pointsPerTraining: 5, trainingMin: 60, total: 100, weeklyQuota: 2, maxPreferences: 6 };
const COUNTS_FOR_QUOTA = ["CONFIRMED", "ATTENDED", "MISSED"] as const;

type Tx = Prisma.TransactionClient;

/** Понедельник московской недели как значение поля @db.Date. */
export const weekStartDb = (d: Date) => new Date(`${mskDayKey(mskWeekStart(d))}T00:00:00Z`);
const weekRange = (weekStart: Date) => {
  const from = new Date(`${weekStart.toISOString().slice(0, 10)}T00:00:00+03:00`);
  return { from, to: addDays(from, 7) };
};

/** Все изменения недели сериализуются блокировкой её строки. */
async function lockWeek(tx: Tx, weekStart: Date) {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status"::text AS status FROM "sport_week" WHERE "weekStart" = ${weekStart}::date FOR UPDATE`;
  return rows[0]?.status ?? null;
}

/** Занятость студентов (пары группы + их тренировки) в интервале — для проверки доступности. */
async function loadBusy(tx: Tx, studentIds: string[], range: { from: Date; to: Date }, excludeSlotId?: string) {
  const profiles = await tx.studentProfile.findMany({ where: { id: { in: studentIds } }, select: { id: true, groupId: true } });
  const groupIds = [...new Set(profiles.map((p) => p.groupId))];
  const lessons = await tx.lesson.findMany({
    where: { offering: { groupId: { in: groupIds } }, status: { not: "CANCELLED" }, startsAt: { gte: range.from, lt: range.to } },
    select: {
      startsAt: true,
      endsAt: true,
      online: true,
      building: { select: { id: true, title: true, lat: true, lon: true } },
      offering: { select: { groupId: true, discipline: { select: { title: true, shortTitle: true } } } },
    },
  });
  const bookings = await tx.sportBooking.findMany({
    where: {
      studentId: { in: studentIds },
      status: { in: [...COUNTS_FOR_QUOTA] },
      slot: { startsAt: { gte: range.from, lt: range.to } },
      ...(excludeSlotId ? { slotId: { not: excludeSlotId } } : {}),
    },
    select: {
      studentId: true,
      slot: {
        select: {
          startsAt: true,
          endsAt: true,
          section: { select: { title: true } },
          building: { select: { id: true, title: true, lat: true, lon: true } },
        },
      },
    },
  });
  const busy = new Map<string, BusyItem[]>(studentIds.map((id) => [id, []]));
  for (const p of profiles) {
    for (const l of lessons.filter((x) => x.offering.groupId === p.groupId)) {
      busy.get(p.id)!.push({
        title: l.offering.discipline.shortTitle ?? l.offering.discipline.title,
        startsAt: l.startsAt,
        endsAt: l.endsAt,
        place: l.online ? null : l.building,
      });
    }
  }
  for (const b of bookings) {
    busy.get(b.studentId)?.push({
      title: `Физкультура: ${b.slot.section.title}`,
      startsAt: b.slot.startsAt,
      endsAt: b.slot.endsAt,
      place: b.slot.building,
    });
  }
  return busy;
}

type SlotRow = { id: string; startsAt: Date; endsAt: Date; building: { id: string; title: string; lat: number; lon: number } };
const sameDay = (busy: BusyItem[], slot: SlotRow) => busy.filter((b) => mskDayKey(b.startsAt) === mskDayKey(slot.startsAt));
const check = (busy: BusyItem[], slot: SlotRow): Unavailable | null =>
  checkSlot({ startsAt: slot.startsAt, endsAt: slot.endsAt, place: slot.building }, sameDay(busy, slot));

const slotSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  room: true,
  coach: true,
  capacity: true,
  section: { select: { title: true } },
  building: { select: { id: true, title: true, lat: true, lon: true, metro: true } },
} satisfies Prisma.SportSlotSelect;

// ─── Обзор для студента ──────────────────────────────────────────────────────

export async function getMySport() {
  const { studentId } = await requireStudent();
  const now = new Date();
  // Без отдельного планировщика: недели с прошедшим дедлайном разыгрываются при первом обращении.
  await drawDueWeeks(now);

  const term = await prisma.academicTerm.findFirst({
    where: { startsOn: { lte: now } },
    orderBy: { startsOn: "desc" },
    select: { id: true, title: true, startsOn: true, endsOn: true },
  });
  const termFrom = term ? new Date(`${term.startsOn.toISOString().slice(0, 10)}T00:00:00+03:00`) : now;
  const termTo = term ? addDays(new Date(`${term.endsOn.toISOString().slice(0, 10)}T00:00:00+03:00`), 1) : now;

  const [attended, missed, extra, myBookings] = await Promise.all([
    prisma.sportBooking.count({ where: { studentId, status: "ATTENDED", slot: { startsAt: { gte: termFrom, lt: termTo } } } }),
    prisma.sportBooking.count({ where: { studentId, status: "MISSED", slot: { startsAt: { gte: termFrom, lt: termTo } } } }),
    term ? prisma.sportExtraPoints.findMany({ where: { studentId, termId: term.id }, select: { title: true, points: true, awardedAt: true } }) : [],
    prisma.sportBooking.findMany({
      where: { studentId, status: { in: ["CONFIRMED", "WAITLIST"] }, slot: { endsAt: { gt: now } } },
      orderBy: { slot: { startsAt: "asc" } },
      select: { id: true, status: true, rank: true, explanation: true, lotteryIndex: true, slotId: true, slot: { select: slotSelect } },
    }),
  ]);

  // Позиция в очереди — на лету, по тем же правилам, что и выдача места.
  // Для подтверждённых — проверка актуального конфликта (пару могли перенести после жеребьёвки).
  const upcoming = await Promise.all(
    myBookings.map(async (b) => {
      if (b.status === "WAITLIST") {
        return { ...b, position: await waitlistPosition(prisma, studentId, b.slotId), conflict: null };
      }
      const day = { from: addDays(b.slot.startsAt, -1), to: addDays(b.slot.startsAt, 1) };
      const busy = (await loadBusy(prisma as unknown as Tx, [studentId], day, b.slotId)).get(studentId)!;
      return { ...b, position: null, conflict: check(busy, b.slot)?.text ?? null };
    }),
  );

  const trainingPoints = attended * SPORT_RULES.pointsPerTraining;
  const extraPoints = extra.reduce((s, e) => s + e.points, 0);
  const weeksLeft = Math.max(0, Math.ceil((termTo.getTime() - now.getTime()) / (7 * 86_400_000)));
  const trainingsNeeded = Math.max(0, Math.ceil((SPORT_RULES.trainingMin - trainingPoints) / SPORT_RULES.pointsPerTraining));

  // Ближайшая открытая неделя для записи (не текущая) и последняя проведённая будущая.
  const nextWeekStart = weekStartDb(addDays(now, 7));
  const openWeek = await prisma.sportWeek.findFirst({
    where: { status: "OPEN", weekStart: { gte: nextWeekStart }, deadline: { gt: now } },
    orderBy: { weekStart: "asc" },
  });
  const drawnWeeks = await prisma.sportWeek.findMany({
    where: { status: "DRAWN", weekStart: { gte: weekStartDb(now) } },
    orderBy: { weekStart: "asc" },
    select: { weekStart: true, drawnAt: true },
  });

  let open = null;
  if (openWeek) {
    const range = weekRange(openWeek.weekStart);
    const [slots, prefs, busy] = await Promise.all([
      prisma.sportSlot.findMany({ where: { weekStart: openWeek.weekStart }, orderBy: { startsAt: "asc" }, select: slotSelect }),
      prisma.sportPreference.findMany({ where: { studentId, weekStart: openWeek.weekStart }, orderBy: { rank: "asc" }, select: { slotId: true } }),
      loadBusy(prisma as unknown as Tx, [studentId], range),
    ]);
    const demand = await prisma.sportPreference.groupBy({
      by: ["slotId"],
      where: { weekStart: openWeek.weekStart },
      _count: { _all: true },
    });
    open = {
      weekStart: openWeek.weekStart,
      deadline: openWeek.deadline,
      slots: slots.map((s) => {
        const reason = check(busy.get(studentId)!, s);
        return {
          ...s,
          unavailable: reason?.text ?? null,
          demand: demand.find((d) => d.slotId === s.id)?._count._all ?? 0,
        };
      }),
      myPreferenceSlotIds: prefs.map((p) => p.slotId),
    };
  }

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
      trainingsNeeded,
      weeksLeft,
    },
    upcoming,
    open,
    drawnWeeks,
    demoDrawEnabled: process.env.SPORT_DEMO_DRAW === "1",
  };
}

export type MySport = Awaited<ReturnType<typeof getMySport>>;

async function waitlistPosition(db: Tx | typeof prisma, studentId: string, slotId: string) {
  const queue = await rankedWaitlist(db as Tx, slotId);
  const i = queue.findIndex((q) => q.studentId === studentId);
  return i < 0 ? null : i + 1;
}

/** Очередь слота: сначала у кого 0 занятий в неделе, потом 1; внутри — порядок жеребьёвки. */
async function rankedWaitlist(tx: Tx, slotId: string) {
  const waiting = await tx.sportBooking.findMany({
    where: { slotId, status: "WAITLIST" },
    select: { id: true, studentId: true, lotteryIndex: true, weekStart: true, rank: true },
  });
  if (!waiting.length) return [];
  const counts = await tx.sportBooking.groupBy({
    by: ["studentId"],
    where: { weekStart: waiting[0].weekStart, studentId: { in: waiting.map((w) => w.studentId) }, status: { in: [...COUNTS_FOR_QUOTA] } },
    _count: { _all: true },
  });
  const countOf = (id: string) => counts.find((c) => c.studentId === id)?._count._all ?? 0;
  // Те же проверки, что при выдаче места: квота, одна тренировка в день, пары и переходы.
  const slot = await tx.sportSlot.findUniqueOrThrow({ where: { id: slotId }, select: { ...slotSelect, weekStart: true } });
  const busy = await loadBusy(tx, waiting.map((w) => w.studentId), weekRange(slot.weekStart), slotId);
  return waiting
    .map((w) => ({ ...w, have: countOf(w.studentId) }))
    .filter((w) => {
      if (w.have >= SPORT_RULES.weeklyQuota) return false;
      const mine = busy.get(w.studentId) ?? [];
      const sameDayTraining = mine.some((x) => x.title.startsWith("Физкультура") && mskDayKey(x.startsAt) === mskDayKey(slot.startsAt));
      return !sameDayTraining && !check(mine, slot);
    })
    .sort((a, b) => a.have - b.have || (a.lotteryIndex ?? 1e9) - (b.lotteryIndex ?? 1e9));
}

// ─── Приоритеты ─────────────────────────────────────────────────────────────

export type SportActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function saveMyPreferences(weekStartIso: string, slotIds: string[]): Promise<SportActionResult> {
  const { studentId } = await requireStudent();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartIso)) return { ok: false, error: "Неверная неделя" };
  const weekStart = new Date(`${weekStartIso}T00:00:00Z`);
  const unique = [...new Set(slotIds)];
  if (unique.length !== slotIds.length) return { ok: false, error: "Слоты повторяются" };
  if (unique.length > SPORT_RULES.maxPreferences) return { ok: false, error: `Не больше ${SPORT_RULES.maxPreferences} приоритетов` };

  return prisma.$transaction(async (tx) => {
    const status = await lockWeek(tx, weekStart);
    if (!status) return { ok: false, error: "Неделя не найдена" };
    const week = await tx.sportWeek.findUniqueOrThrow({ where: { weekStart } });
    if (status !== "OPEN" || week.deadline <= new Date()) return { ok: false, error: "Приём приоритетов на эту неделю закрыт" };

    const slots = await tx.sportSlot.findMany({ where: { id: { in: unique }, weekStart }, select: slotSelect });
    if (slots.length !== unique.length) return { ok: false, error: "Есть тренировки не из этой недели" };
    const busy = (await loadBusy(tx, [studentId], weekRange(weekStart))).get(studentId)!;
    for (const s of slots) {
      const reason = check(busy, s);
      if (reason) return { ok: false, error: `${s.section.title}: ${reason.text}` };
    }

    await tx.sportPreference.deleteMany({ where: { studentId, weekStart } });
    if (unique.length) {
      await tx.sportPreference.createMany({
        data: unique.map((slotId, i) => ({ studentId, slotId, weekStart, rank: i + 1 })),
      });
    }
    return { ok: true, message: unique.length ? "Приоритеты сохранены" : "Приоритеты очищены" };
  });
}

// ─── Жеребьёвка ─────────────────────────────────────────────────────────────

/** Провести жеребьёвку недели. Атомарно: либо все брони и статус DRAWN, либо ничего. */
export async function drawWeek(weekStart: Date) {
  return prisma.$transaction(
    async (tx) => {
      const status = await lockWeek(tx, weekStart);
      if (status !== "OPEN") return { ok: false as const, error: "Жеребьёвка этой недели уже проведена" };

      const slots = await tx.sportSlot.findMany({ where: { weekStart }, select: slotSelect });
      const prefs = await tx.sportPreference.findMany({ where: { weekStart }, select: { studentId: true, slotId: true, rank: true } });
      const participants = [...new Set(prefs.map((p) => p.studentId))];
      const busy = await loadBusy(tx, participants, weekRange(weekStart));
      const slotById = new Map(slots.map((s) => [s.id, s]));
      const seed = randomUUID();

      const result = allocate({
        seed,
        slots: slots.map((s) => ({ id: s.id, capacity: s.capacity, startsAt: s.startsAt, endsAt: s.endsAt })),
        preferences: prefs,
        weeklyQuota: SPORT_RULES.weeklyQuota,
        unavailableReason: (studentId, slotId) => {
          const r = check(busy.get(studentId) ?? [], slotById.get(slotId)!);
          return r ? shortReason(r) : null;
        },
      });
      const indexOf = new Map(result.order.map((id, i) => [id, i]));

      await tx.sportBooking.createMany({
        data: result.assignments.map((a) => ({
          studentId: a.studentId,
          slotId: a.slotId,
          weekStart,
          status: a.status,
          rank: a.rank,
          lotteryIndex: indexOf.get(a.studentId),
          explanation: a.explanation,
        })),
      });
      await tx.sportWeek.update({
        where: { weekStart },
        data: { status: "DRAWN", seed, lotteryOrder: result.order, drawnAt: new Date() },
      });

      // Уведомляем только студентов с учётной записью (симулированные участники входить не могут).
      const real = await tx.studentProfile.findMany({
        where: { id: { in: participants }, user: { accounts: { some: {} } } },
        select: { id: true, userId: true },
      });
      for (const r of real) {
        const mine = result.assignments.filter((a) => a.studentId === r.id);
        const got = mine.filter((a) => a.status === "CONFIRMED").length;
        const waits = mine.filter((a) => a.status === "WAITLIST").length;
        await tx.notification.create({
          data: {
            kind: "ANNOUNCEMENT",
            title: "Итоги записи на физкультуру",
            body:
              got > 0
                ? `Вам назначено тренировок: ${got}. ${waits ? `Ещё в листе ожидания: ${waits}. ` : ""}Они уже в расписании.`
                : `Мест по вашим приоритетам не хватило — вы в листе ожидания (${waits}). Освободится место — запишем автоматически.`,
            important: true,
            recipients: { create: { userId: r.userId } },
          },
        });
      }
      return { ok: true as const, confirmed: result.assignments.filter((a) => a.status === "CONFIRMED").length, participants: participants.length };
    },
    { timeout: 30_000 },
  );
}

const DEMO_WEEKS_AHEAD = 3;

/** Жеребьёвка недель, у которых прошёл дедлайн (вместо планировщика — при первом обращении). */
export async function drawDueWeeks(now = new Date()) {
  const due = await prisma.sportWeek.findMany({ where: { status: "OPEN", deadline: { lte: now } }, select: { weekStart: true } });
  for (const w of due) await drawWeek(w.weekStart); // повторный/параллельный вызов безопасен: блокировка + проверка статуса
}

/** Демо: «ускорить время» и провести жеребьёвку ближайшей открытой недели. Только при SPORT_DEMO_DRAW=1. */
export async function runDemoDraw(): Promise<SportActionResult> {
  const { userId } = await requireStudent();
  if (process.env.SPORT_DEMO_DRAW !== "1") return { ok: false, error: "Демо-режим выключен" };
  // Только тестовые аккаунты жюри и только ближайшие недели — чтобы демо не закрыло запись на весь семестр.
  const allowed = (process.env.SPORT_DEMO_ACCOUNTS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true } });
  if (!me.username || !allowed.includes(me.username)) return { ok: false, error: "Демо-жеребьёвка недоступна этому аккаунту" };
  const now = new Date();
  const week = await prisma.sportWeek.findFirst({
    where: { status: "OPEN", weekStart: { gte: weekStartDb(addDays(now, 7)), lte: weekStartDb(addDays(now, 7 * DEMO_WEEKS_AHEAD)) } },
    orderBy: { weekStart: "asc" },
    select: { weekStart: true },
  });
  if (!week) return { ok: false, error: `Демо доступно только на ${DEMO_WEEKS_AHEAD} ближайшие недели — они уже разыграны` };
  const r = await drawWeek(week.weekStart);
  return r.ok
    ? { ok: true, message: `Жеребьёвка проведена: участников ${r.participants}, выдано мест ${r.confirmed}` }
    : { ok: false, error: r.error };
}

// ─── Отмена и продвижение очереди ───────────────────────────────────────────

/** Отменить свою запись (или выйти из очереди) до начала тренировки. Освободившееся место — следующему в очереди. */
export async function cancelMyBooking(bookingId: string): Promise<SportActionResult> {
  const { studentId } = await requireStudent();
  const booking = await prisma.sportBooking.findFirst({
    where: { id: bookingId, studentId },
    select: { weekStart: true },
  });
  if (!booking) notFound();

  return prisma.$transaction(async (tx) => {
    await lockWeek(tx, booking.weekStart);
    const b = await tx.sportBooking.findFirst({
      where: { id: bookingId, studentId },
      select: { status: true, slotId: true, slot: { select: { startsAt: true } } },
    });
    if (!b) notFound();
    if (b.slot.startsAt <= new Date()) return { ok: false, error: "Тренировка уже началась — отменить нельзя" };
    if (b.status !== "CONFIRMED" && b.status !== "WAITLIST") return { ok: false, error: "Эту запись уже нельзя отменить" };

    await tx.sportBooking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
    if (b.status === "WAITLIST") return { ok: true, message: "Вы вышли из листа ожидания" };

    // Освободились место и квота — пересматриваем очереди всей недели, а не только этого слота.
    const promoted = await promoteWeek(tx, booking.weekStart);
    return { ok: true, message: promoted ? "Запись отменена, место передано из листа ожидания" : "Запись отменена" };
  });
}

async function promoteWeek(tx: Tx, weekStart: Date) {
  let total = 0;
  for (let changed = true; changed; ) {
    changed = false;
    const slots = await tx.sportSlot.findMany({
      where: { weekStart, startsAt: { gt: new Date() }, bookings: { some: { status: "WAITLIST" } } },
      select: { id: true },
    });
    for (const s of slots) {
      while (await promoteFromWaitlist(tx, s.id)) {
        changed = true;
        total++;
      }
    }
  }
  return total;
}

async function promoteFromWaitlist(tx: Tx, slotId: string) {
  const slot = await tx.sportSlot.findUniqueOrThrow({ where: { id: slotId }, select: { ...slotSelect, weekStart: true } });
  const taken = await tx.sportBooking.count({ where: { slotId, status: { in: [...COUNTS_FOR_QUOTA] } } });
  if (taken >= slot.capacity) return false;

  for (const candidate of await rankedWaitlist(tx, slotId)) {
    // Повторная проверка: расписание могло измениться после жеребьёвки.
    const busy = (await loadBusy(tx, [candidate.studentId], weekRange(slot.weekStart), slotId)).get(candidate.studentId)!;
    const sameDayTraining = busy.some((x) => x.title.startsWith("Физкультура") && mskDayKey(x.startsAt) === mskDayKey(slot.startsAt));
    if (sameDayTraining || check(busy, slot)) continue;

    await tx.sportBooking.update({
      where: { id: candidate.id },
      data: { status: "CONFIRMED", explanation: `${candidate.rank}-й выбор: место освободилось — из листа ожидания` },
    });
    const profile = await tx.studentProfile.findUniqueOrThrow({
      where: { id: candidate.studentId },
      select: { userId: true, user: { select: { accounts: { select: { id: true }, take: 1 } } } },
    });
    if (profile.user.accounts.length) {
      await tx.notification.create({
        data: {
          kind: "ANNOUNCEMENT",
          title: `Освободилось место: ${slot.section.title}`,
          body: `Вы записаны из листа ожидания. Тренировка уже в расписании.`,
          important: true,
          recipients: { create: { userId: profile.userId } },
        },
      });
    }
    return true;
  }
  return false;
}
