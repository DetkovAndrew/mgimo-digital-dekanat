import { mskDayKey } from "./format";

/** Куда ведёт уведомление: заявка; перенос пары — на неделю, где сейчас стоит пара (перенос на следующую неделю иначе
 * не виден на текущей). Дата, а не номер недели: неделю считает расписание при открытии (ревью Codex 95).
 * Общая для списка «Уведомлений» и push на телефон. */
export function notificationLink(n: { kind: string; requestId: string | null; lesson?: { startsAt: Date } | null }): { href: string; label: string } | null {
  if (n.requestId) return { href: `/requests/${n.requestId}`, label: "Открыть заявку" };
  if (n.kind === "SCHEDULE_CHANGE") return { href: n.lesson ? `/schedule?view=week&on=${mskDayKey(n.lesson.startsAt)}` : "/schedule", label: "К расписанию" };
  return null;
}
