import { z } from "zod";

// Перенос и отмена пары сотрудником деканата (src/server/dal/staff-schedule.ts). Здесь — только проверка ввода:
// права, блокировки и накладки проверяет сервер. Время — московское, часы занятий демонстрационные.

export const LESSON_HOURS = { opens: "08:00", closes: "21:30" } as const;
const MIN_MINUTES = 30;
const MAX_MINUTES = 240;
/** На сколько дней вперёд можно перенести пару. */
export const MOVE_WINDOW_DAYS = 60;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Укажите время в формате ЧЧ:ММ");
const id = z.string().trim().min(1).max(64);
const reason = z.string().trim().min(5, "Причину — хотя бы в нескольких словах: её увидят студенты").max(200, "Причина — до 200 символов");
/** Время и статус пары, которые видел сотрудник: если пару успели изменить, второе изменение не применяется. */
const expected = z.string().max(200); // два времени ISO, статус, аудитория, корпус — около 80 символов

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const rescheduleSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), id, expected, reason }),
  // Вернуть время, место и статус, какими они были до первого изменения деканатом (src/server/staff-undo.ts).
  z.object({ action: z.literal("restore"), id, expected }),
  z
    .object({
      action: z.literal("move"),
      id,
      expected,
      reason,
      date: z.iso.date("Укажите дату"),
      start: hhmm,
      end: hhmm,
      building: z.string().trim().max(32),
      // Пусто — та же аудитория (или онлайн, если пара онлайн).
      room: z.union([z.literal(""), z.string().trim().regex(/^\d{3,4}$/, "Номер аудитории — 3–4 цифры, например 1206")]),
    })
    .superRefine((v, ctx) => {
      const from = toMinutes(v.start);
      const to = toMinutes(v.end);
      if (to - from < MIN_MINUTES || to - from > MAX_MINUTES)
        ctx.addIssue({ code: "custom", path: ["end"], message: `Пара — от ${MIN_MINUTES} минут до ${MAX_MINUTES / 60} часов, конец позже начала` });
      if (from < toMinutes(LESSON_HOURS.opens) || to > toMinutes(LESSON_HOURS.closes))
        ctx.addIssue({ code: "custom", path: ["start"], message: `Занятия — с ${LESSON_HOURS.opens} до ${LESSON_HOURS.closes}` });
    }),
]);

export type RescheduleInput = z.infer<typeof rescheduleSchema>;
export type ScheduleActionState = { ok: boolean; message?: string };

/** Московское время из даты и «ЧЧ:ММ». */
export const mskAt = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`);

/** Строка «что видел сотрудник»: время, статус и место пары. Любое чужое изменение между открытием и отправкой её меняет. */
export const lessonVersion = (l: { startsAt: Date; endsAt: Date; status: string; room: string | null; building: { id: string } | null }) =>
  [l.startsAt.toISOString(), l.endsAt.toISOString(), l.status, l.room ?? "", l.building?.id ?? ""].join("|");
