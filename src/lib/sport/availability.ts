import { judgeTransfer, type Point } from "../geo";

// Можно ли студенту на тренировку: не пересекается ли с парами и успевает ли он дойти
// до спорткомплекса и обратно (с запасом на переодевание). Оценка времени примерная —
// формулировки «по нашей оценке», без категоричных обещаний.

export const CHANGE_MIN = 10; // переодевание до и после тренировки

type Place = (Point & { id: string; title: string }) | null; // null — онлайн
export type BusyItem = { title: string; startsAt: Date; endsAt: Date; place: Place };
export type SlotLike = { startsAt: Date; endsAt: Date; place: Point & { id: string; title: string } };

export type Unavailable = { code: "OVERLAP" | "CHANGE_TIME" | "TRANSFER_BEFORE" | "TRANSFER_AFTER"; text: string };

const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(d);

/** null — можно; иначе причина. busy — пары и другие тренировки студента в тот же день. */
export function checkSlot(slot: SlotLike, busy: BusyItem[]): Unavailable | null {
  for (const b of busy) {
    if (b.startsAt < slot.endsAt && slot.startsAt < b.endsAt) {
      return { code: "OVERLAP", text: `пересекается с «${b.title}» ${hhmm(b.startsAt)}–${hhmm(b.endsAt)}` };
    }
  }
  // Запас на переодевание нужен даже в том же корпусе и после онлайн-пары (в обе стороны).
  for (const b of busy) {
    const gapBefore = (+slot.startsAt - +b.endsAt) / 60_000;
    const gapAfter = (+b.startsAt - +slot.endsAt) / 60_000;
    if (b.place && gapBefore >= 0 && gapBefore < CHANGE_MIN) {
      return { code: "CHANGE_TIME", text: `сразу после «${b.title}» — нет ${CHANGE_MIN} минут на переодевание` };
    }
    if (b.place && gapAfter >= 0 && gapAfter < CHANGE_MIN) {
      return { code: "CHANGE_TIME", text: `сразу перед «${b.title}» — нет ${CHANGE_MIN} минут на переодевание` };
    }
  }
  const before = busy.filter((b) => b.endsAt <= slot.startsAt && b.place).sort((a, b) => +b.endsAt - +a.endsAt)[0];
  if (before) {
    const gap = Math.round((+slot.startsAt - +before.endsAt) / 60_000) - CHANGE_MIN;
    const v = judgeTransfer(before.place!, slot.place, Math.max(0, gap));
    if (v.kind === "impossible") {
      return {
        code: "TRANSFER_BEFORE",
        text: `по нашей оценке не успеть после «${before.title}»: ${before.place!.title} → ${slot.place.title} ≈ ${v.estimate.transitMin} мин, а есть ${Math.max(0, gap)} (с учётом переодевания)`,
      };
    }
  }
  const after = busy.filter((b) => b.startsAt >= slot.endsAt && b.place).sort((a, b) => +a.startsAt - +b.startsAt)[0];
  if (after) {
    const gap = Math.round((+after.startsAt - +slot.endsAt) / 60_000) - CHANGE_MIN;
    const v = judgeTransfer(slot.place, after.place!, Math.max(0, gap));
    if (v.kind === "impossible") {
      return {
        code: "TRANSFER_AFTER",
        text: `по нашей оценке не успеть на «${after.title}»: ${slot.place.title} → ${after.place!.title} ≈ ${v.estimate.transitMin} мин, а есть ${Math.max(0, gap)} (с учётом переодевания)`,
      };
    }
  }
  return null;
}

export const shortReason = (u: Unavailable) =>
  u.code === "OVERLAP" ? "пересечение с парой" : u.code === "CHANGE_TIME" ? "нет времени переодеться" : "не успеть дойти";
