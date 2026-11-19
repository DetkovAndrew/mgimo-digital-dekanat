import "server-only";
import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import type { IcsEvent } from "@/lib/calendar/ics";
import { addDays, formatDateTime, lessonKindLabel, mskStartOfDay, mskWeekStart } from "@/lib/format";
import { prisma } from "../db";
import { requireStudent } from "../session";

// Календарь студента (docs/plans/calendar.md): подписка по секретной ссылке, файл и одно событие — по сессии.
// Подписка — второй открытый эндпоинт с данными студента (после /verify): календарь телефона ходит без cookies.
// В ней только расписание, без свободного текста (причины переноса, цели брони) и без результатов аттестаций.

const FEED_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const FEED_ROTATE_COOLDOWN_MS = 60_000;
const ORIGIN = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const UID = (kind: string, id: string) => `${kind}-${id}@university-dekanat`;

// ─── Токен подписки: HMAC от секрета сервера (HKDF «univ-calendar-v1») и версии; в БД — только SHA-256 ─────────────

function feedToken(studentId: string, version: number): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (!secret) throw new Error("Не задан секрет сервера.");
  const key = hkdfSync("sha256", secret, new Uint8Array(), "univ-calendar-v1", 32);
  return createHmac("sha256", key).update(JSON.stringify(["feed", studentId, version])).digest("base64url");
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const feedLinks = (token: string) => {
  const https = new URL(`/api/calendar/feed/${token}`, ORIGIN());
  const webcal = `webcal://${https.host}${https.pathname}`;
  return { https: https.toString(), webcal };
};

/**
 * Ссылка подписки владельца. Первый выпуск — upsert по studentId (два одновременных открытия дают одну запись).
 * Хеш не совпал с пересчитанным токеном (сменился секрет сервера) — старая ссылка уже не работает, выпускаем новую.
 * Запись — только если версия и хеш не изменились с чтения (CAS): параллельная ротация не перезаписывается (ревью Codex 85).
 */
export async function getMyFeed() {
  const { studentId } = await requireStudent();
  for (let attempt = 0; attempt < 3; attempt++) {
    // Upsert Prisma здесь не атомарный (поиск, затем вставка): второе одновременное открытие получает P2002 —
    // строку уже создал первый, следующая попытка её прочитает.
    const feed = await prisma.calendarFeed
      .upsert({
        where: { studentId },
        create: { studentId, version: 1, tokenHash: sha256(feedToken(studentId, 1)) },
        update: {},
        select: { version: true, tokenHash: true, rotatedAt: true },
      })
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === "P2002") return null;
        throw e;
      });
    if (!feed) continue;
    const token = feedToken(studentId, feed.version);
    const links = { ...feedLinks(token), rotatedAt: feed.rotatedAt, nextRotationAt: new Date(feed.rotatedAt.getTime() + FEED_ROTATE_COOLDOWN_MS) };
    if (feed.tokenHash === sha256(token)) return links;
    const { count } = await prisma.calendarFeed.updateMany({ where: { studentId, version: feed.version, tokenHash: feed.tokenHash }, data: { tokenHash: sha256(token) } });
    if (count) return links;
  }
  throw new Error("Не удалось выпустить ссылку подписки.");
}

/** Новая ссылка: version + 1 атомарно и не чаще раза в минуту. Старый токен перестаёт находиться. */
export async function rotateMyFeed(now = new Date()): Promise<{ ok: boolean; message: string }> {
  const { studentId } = await requireStudent();
  const feed = await prisma.calendarFeed.findUnique({ where: { studentId }, select: { version: true } });
  if (!feed) return { ok: false, message: "Сначала откройте страницу подписки." };
  const version = feed.version + 1;
  const { count } = await prisma.calendarFeed.updateMany({
    where: { studentId, version: feed.version, rotatedAt: { lt: new Date(now.getTime() - FEED_ROTATE_COOLDOWN_MS) } },
    data: { version, tokenHash: sha256(feedToken(studentId, version)), rotatedAt: now },
  });
  return count ? { ok: true, message: "Новая ссылка выпущена: старая подписка больше не обновляется." } : { ok: false, message: "Новую ссылку можно выпустить не чаще раза в минуту." };
}

/** Владелец подписки по токену из адреса; неверный или старый токен — null (наружу — 404 без подсказок). */
export async function feedOwnerByToken(token: unknown) {
  if (typeof token !== "string" || !FEED_TOKEN.test(token)) return null;
  const feed = await prisma.calendarFeed.findUnique({
    where: { tokenHash: sha256(token) },
    select: { studentId: true, version: true, student: { select: { groupId: true } } },
  });
  if (!feed) return null;
  // Хеш совпал — дополнительно сверяем с пересчётом: после смены секрета старые ссылки не работают.
  const expected = Buffer.from(feedToken(feed.studentId, feed.version));
  const given = Buffer.from(token);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { studentId: feed.studentId, groupId: feed.student.groupId };
}

// ─── События ───────────────────────────────────────────────────────────────────────────────────────────────────

type Owner = { studentId: string; groupId: string };
type Range = { from: Date; to: Date };
/** detailed — выгрузка по сессии (файл, одно событие): с причиной переноса и целью брони. В подписке — без них. */
type Opts = { detailed: boolean };

const assessmentLabel: Record<string, string> = { EXAM: "Экзамен", CREDIT: "Зачёт", GRADED_CREDIT: "Зачёт с оценкой", MIDTERM: "Контрольная", ASSIGNMENT: "Работа" };
const place = (room: string | null, building: { title: string } | null, online: boolean) =>
  online ? "онлайн" : [room, building?.title].filter(Boolean).join(", ") || null;

const lessonSelect = {
  id: true, kind: true, startsAt: true, endsAt: true, room: true, online: true, status: true,
  building: { select: { title: true } },
  teacher: { select: { fullName: true } },
  offering: { select: { discipline: { select: { title: true } }, leadTeacher: { select: { fullName: true } } } },
  changes: { orderBy: { createdAt: "desc" }, take: 1, select: { previousStartsAt: true, reason: true } },
} as const;

type LessonRow = { id: string; kind: string; startsAt: Date; endsAt: Date; room: string | null; online: boolean; status: string; building: { title: string } | null; teacher: { fullName: string } | null; offering: { discipline: { title: string }; leadTeacher: { fullName: string } }; changes: { previousStartsAt: Date; reason: string | null }[] };

function lessonEvent(l: LessonRow, { detailed }: Opts): IcsEvent {
  const title = l.offering.discipline.title;
  const kind = (lessonKindLabel[l.kind] ?? "Занятие").toLowerCase();
  const cancelled = l.status === "CANCELLED";
  const ch = l.changes[0];
  const lines = [`Преподаватель: ${(l.teacher ?? l.offering.leadTeacher).fullName}`];
  if (l.status === "RESCHEDULED" && ch) lines.push(`Изменено, было: ${formatDateTime(ch.previousStartsAt)}`);
  if (cancelled) lines.push("Пара отменена");
  if (detailed && ch?.reason && l.status !== "SCHEDULED") lines.push(`Причина: ${ch.reason}`);
  return {
    uid: UID("lesson", l.id),
    start: l.startsAt,
    end: l.endsAt,
    summary: `${cancelled ? "Отменено · " : l.status === "RESCHEDULED" ? "Изменено · " : ""}${title} · ${kind}`,
    location: place(l.room, l.building, l.online),
    description: lines.join("\n"),
    url: new URL(`/lessons/${l.id}`, ORIGIN()).toString(),
    cancelled,
  };
}

type AssessmentRow = { id: string; kind: string; title: string; dueAt: Date | null; scheduledAt: Date | null; room: string | null; offering: { discipline: { title: string } } };

function assessmentEvent(a: AssessmentRow, opts: { alarm?: boolean } = {}): IcsEvent {
  const discipline = a.offering.discipline.title;
  if (a.dueAt) {
    return {
      uid: UID("deadline", a.id),
      start: new Date(a.dueAt.getTime() - 30 * 60_000),
      end: a.dueAt,
      summary: `Срок: ${a.title} · ${discipline}`,
      description: "Срок сдачи работы — конец события.",
      url: new URL("/grades", ORIGIN()).toString(),
      alarmMinutes: opts.alarm ? 24 * 60 : undefined,
    };
  }
  const start = a.scheduledAt!;
  return {
    uid: UID("exam", a.id),
    start,
    end: new Date(start.getTime() + (a.kind === "MIDTERM" ? 90 : 120) * 60_000),
    summary: `${assessmentLabel[a.kind] ?? "Контроль"} · ${discipline}`,
    location: a.room,
    description: "Продолжительность примерная: в расписании указано только начало.",
    url: new URL("/grades", ORIGIN()).toString(),
    alarmMinutes: opts.alarm ? 24 * 60 : undefined,
  };
}

const assessmentSelect = { id: true, kind: true, title: true, dueAt: true, scheduledAt: true, room: true, offering: { select: { discipline: { select: { title: true } } } } } as const;
const sportSelect = { id: true, slot: { select: { startsAt: true, endsAt: true, room: true, coach: true, section: { select: { title: true } }, building: { select: { title: true } } } } } as const;
const roomSelect = { id: true, startsAt: true, endsAt: true, purpose: true, room: { select: { number: true, building: { select: { title: true } } } } } as const;

type SportRow = { id: string; slot: { startsAt: Date; endsAt: Date; room: string; coach: string; section: { title: string }; building: { title: string } } };
const sportEvent = (b: SportRow): IcsEvent => ({
  uid: UID("sport", b.id),
  start: b.slot.startsAt,
  end: b.slot.endsAt,
  summary: `Физкультура · ${b.slot.section.title}`,
  location: [b.slot.room, b.slot.building.title].filter(Boolean).join(", "),
  description: `Тренер: ${b.slot.coach}`,
  url: new URL("/sport", ORIGIN()).toString(),
});

type RoomRow = { id: string; startsAt: Date; endsAt: Date; purpose: string; room: { number: string; building: { title: string } } };
const roomEvent = (b: RoomRow, { detailed }: Opts): IcsEvent => ({
  uid: UID("room", b.id),
  start: b.startsAt,
  end: b.endsAt,
  summary: `Бронь: ауд. ${b.room.number}`,
  location: `ауд. ${b.room.number}, ${b.room.building.title}`,
  description: detailed ? `Цель: ${b.purpose}` : null,
  url: new URL("/services", ORIGIN()).toString(),
});

/** Все события студента в диапазоне: пары группы, его тренировки и брони, экзамены и сроки группы (без результатов). */
async function eventsFor(owner: Owner, range: Range, opts: Opts): Promise<IcsEvent[]> {
  const inRange = { gte: range.from, lt: range.to };
  const [lessons, assessments, sport, rooms] = await Promise.all([
    prisma.lesson.findMany({ where: { offering: { groupId: owner.groupId }, startsAt: inRange }, orderBy: { startsAt: "asc" }, select: lessonSelect }),
    prisma.assessment.findMany({ where: { offering: { groupId: owner.groupId }, OR: [{ dueAt: inRange }, { dueAt: null, scheduledAt: inRange }] }, select: assessmentSelect }),
    prisma.sportBooking.findMany({ where: { studentId: owner.studentId, status: { in: ["CONFIRMED", "ATTENDED", "MISSED"] }, slot: { startsAt: inRange } }, select: sportSelect }),
    prisma.roomBooking.findMany({ where: { studentId: owner.studentId, status: "CONFIRMED", startsAt: inRange }, select: roomSelect }),
  ]);
  return [
    ...lessons.map((l) => lessonEvent(l, opts)),
    ...assessments.map((a) => assessmentEvent(a, { alarm: opts.detailed })),
    ...sport.map(sportEvent),
    ...rooms.map((b) => roomEvent(b, opts)),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Диапазон подписки и файла «семестр»: 14 дней назад — конец сессии текущего семестра, не дальше 180 дней. */
async function termRange(groupId: string, now = new Date()): Promise<Range> {
  const term = await prisma.academicTerm.findFirst({
    where: { startsOn: { lte: now }, offerings: { some: { groupId } } },
    orderBy: { startsOn: "desc" },
    select: { sessionEndsOn: true },
  });
  const from = addDays(mskStartOfDay(now), -14);
  const max = addDays(mskStartOfDay(now), 180);
  const end = term ? addDays(new Date(`${term.sessionEndsOn.toISOString().slice(0, 10)}T00:00:00+03:00`), 1) : max;
  return { from, to: end < max && end > from ? end : max };
}

/** Подписка: владелец — из токена (feedOwnerByToken), без свободного текста. */
export async function feedEvents(owner: Owner) {
  return eventsFor(owner, await termRange(owner.groupId), { detailed: false });
}

/** Файл по сессии: текущая неделя или семестр с сессией. Диапазон задаёт сервер. */
export async function getMyCalendarFile(scope: "week" | "term") {
  const { studentId, groupId } = await requireStudent();
  const now = new Date();
  const range = scope === "week" ? { from: mskWeekStart(now), to: addDays(mskWeekStart(now), 7) } : await termRange(groupId, now);
  return eventsFor({ studentId, groupId }, range, { detailed: true });
}

export const EVENT_KINDS = ["lesson", "assessment", "sport", "room"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Одно событие по сессии. Пара и аттестация — только своей группы, тренировка и бронь — только свои; иначе null (404). */
export async function getMyEvent(kind: EventKind, id: string): Promise<IcsEvent | null> {
  const { studentId, groupId } = await requireStudent();
  if (kind === "lesson") {
    const l = await prisma.lesson.findFirst({ where: { id, offering: { groupId } }, select: lessonSelect });
    if (l) return lessonEvent(l, { detailed: true });
  } else if (kind === "assessment") {
    const a = await prisma.assessment.findFirst({ where: { id, offering: { groupId }, OR: [{ dueAt: { not: null } }, { scheduledAt: { not: null } }] }, select: assessmentSelect });
    if (a) return assessmentEvent(a, { alarm: true });
  } else if (kind === "sport") {
    const b = await prisma.sportBooking.findFirst({ where: { id, studentId, status: { in: ["CONFIRMED", "ATTENDED", "MISSED"] } }, select: sportSelect });
    if (b) return sportEvent(b);
  } else {
    const b = await prisma.roomBooking.findFirst({ where: { id, studentId, status: "CONFIRMED" }, select: roomSelect });
    if (b) return roomEvent(b, { detailed: true });
  }
  return null;
}
