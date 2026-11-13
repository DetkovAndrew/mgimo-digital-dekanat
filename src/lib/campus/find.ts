import { addDays, mskDayKey } from "@/lib/format";
import { PLANS } from "./plans";
import { ROOM_RULES, roomDayKeys } from "./rules";

// «Найти свободную» (/rooms/find): параметры поиска из адреса — день, начало, длительность, корпус, вместимость.
// Один разбор и для страницы, и для ссылок помощника (src/lib/assistant/links.ts): всё вне правил брони отбрасывается.

export type FindQuery = { d: string; t: string; m: number; b: string | null; c: number };

export const FIND_DURATIONS = [30, 60, 90, 120, 150, 180] as const;
export const FIND_CAPACITIES = [0, 10, 20, 40] as const;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const OPEN = toMin(ROOM_RULES.opens);
const CLOSE = toMin(ROOM_RULES.closes);

/** Начала на сетке брони для длительности m (последнее — чтобы закончить к закрытию). */
export const findStarts = (m: number) => Array.from({ length: (CLOSE - OPEN - m) / ROOM_RULES.stepMin + 1 }, (_, i) => toHHMM(OPEN + i * ROOM_RULES.stepMin));

/** Ближайшее начало по умолчанию: сегодня — следующий шаг сетки (не раньше открытия), поздно вечером — завтра в 10:00. */
function defaultStart(now: Date, m: number): { d: string; t: string } {
  const today = mskDayKey(now);
  const parts = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const nowMin = Number(parts.find((p) => p.type === "hour")!.value) * 60 + Number(parts.find((p) => p.type === "minute")!.value);
  const next = Math.max(OPEN, Math.ceil((nowMin + 1) / ROOM_RULES.stepMin) * ROOM_RULES.stepMin);
  return next + m <= CLOSE ? { d: today, t: toHHMM(next) } : { d: mskDayKey(addDays(now, 1)), t: "10:00" };
}

export function parseFind(sp: Record<string, unknown>, now = new Date()): FindQuery {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const m = FIND_DURATIONS.find((x) => String(x) === str("m")) ?? 90;
  const fallback = defaultStart(now, m);
  const d = roomDayKeys(now).includes(str("d") ?? "") ? str("d")! : fallback.d;
  const t = findStarts(m).includes(str("t") ?? "") ? str("t")! : d === fallback.d ? fallback.t : "10:00";
  const b = PLANS.some((p) => p.buildingId === str("b")) ? str("b") : null;
  const c = FIND_CAPACITIES.find((x) => String(x) === str("c")) ?? 0;
  return { d, t, m, b, c };
}

export function findHref(q: FindQuery) {
  const p = new URLSearchParams({ d: q.d, t: q.t, m: String(q.m) });
  if (q.b) p.set("b", q.b);
  if (q.c) p.set("c", String(q.c));
  return `/rooms/find?${p}`;
}

export const endOf = (q: Pick<FindQuery, "t" | "m">) => toHHMM(toMin(q.t) + q.m);
