import { addDays, mskDayKey, mskStartOfDay } from "@/lib/format";

// Правила брони аудиторий (демонстрационные, показываются в интерфейсе). Время — Москва.
export const ROOM_RULES = {
  opens: "08:00",
  closes: "21:00",
  stepMin: 30,
  minMinutes: 30,
  maxMinutes: 180,
  windowDays: 7,
  maxActive: 2,
  maxPerDay: 1,
  purposeMax: 120,
} as const;

/** Дни, доступные для просмотра и брони: сегодня и ещё 6. */
export function roomDayKeys(now = new Date()) {
  return Array.from({ length: ROOM_RULES.windowDays }, (_, i) => mskDayKey(addDays(mskStartOfDay(now), i)));
}

const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+03:00`);
const hhmm = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(d);

/** Свободные начала с шагом 30 минут и сколько минут подряд свободно (до 3 ч). Пересечение: a.from < b.to && a.to > b.from. */
export function slotStarts(day: string, busy: { from: Date; to: Date }[], now = new Date()) {
  const open = at(day, ROOM_RULES.opens).getTime();
  const close = at(day, ROOM_RULES.closes).getTime();
  const step = ROOM_RULES.stepMin * 60_000;
  const out: { start: string; max: number }[] = [];
  for (let t = open; t + step <= close; t += step) {
    if (t <= now.getTime()) continue;
    let len = 0;
    while (len < ROOM_RULES.maxMinutes && t + (len + ROOM_RULES.stepMin) * 60_000 <= close) {
      const a = t + len * 60_000;
      const b = a + step;
      if (busy.some((x) => x.from.getTime() < b && x.to.getTime() > a)) break;
      len += ROOM_RULES.stepMin;
    }
    if (len >= ROOM_RULES.minMinutes) out.push({ start: hhmm(new Date(t)), max: len });
  }
  return out;
}
