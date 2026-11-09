// Всё время показываем по Москве, независимо от часового пояса устройства.
const TZ = "Europe/Moscow";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, ...opts });

const timeFmt = fmt({ hour: "2-digit", minute: "2-digit" });
const dayFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const dateFmt = fmt({ day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = fmt({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const isoDayFmt = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });

export const formatTime = (d: Date) => timeFmt.format(d);
export const formatDay = (d: Date) => dayFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);

/** Московская дата в виде YYYY-MM-DD. */
export function mskDayKey(d: Date): string {
  const p = Object.fromEntries(isoDayFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Начало московских суток. Москва — UTC+3 без перехода на летнее время. */
export const mskStartOfDay = (d: Date) => new Date(`${mskDayKey(d)}T00:00:00+03:00`);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Понедельник московской недели, в которой находится дата. */
export function mskWeekStart(d: Date): Date {
  const weekday = (new Date(`${mskDayKey(d)}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 — понедельник
  return addDays(mskStartOfDay(d), -weekday);
}

export const lessonKindLabel: Record<string, string> = {
  LECTURE: "Лекция",
  SEMINAR: "Семинар",
  LANGUAGE: "Иностранный язык",
  PRACTICE: "Практика",
  CONSULTATION: "Консультация",
};

export type Tone = "neutral" | "info" | "warn" | "ok" | "bad";

export const requestStatusLabel: Record<string, { label: string; tone: Tone }> = {
  SUBMITTED: { label: "Подана", tone: "neutral" },
  IN_PROGRESS: { label: "В работе", tone: "info" },
  NEEDS_INFO: { label: "Нужно уточнение", tone: "warn" },
  READY: { label: "Готова", tone: "ok" },
  DONE: { label: "Исполнена", tone: "ok" },
  REJECTED: { label: "Отклонена", tone: "bad" },
  CANCELLED: { label: "Отозвана", tone: "neutral" },
};

export const controlFormLabel: Record<string, string> = {
  EXAM: "Экзамен",
  CREDIT: "Зачёт",
  GRADED_CREDIT: "Зачёт с оценкой",
};
