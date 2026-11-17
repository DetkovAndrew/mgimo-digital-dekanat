import { judgeTransfer, type TransferVerdict } from "./geo";

type LessonLike = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  online: boolean;
  building: { id: string; lat: number; lon: number; title: string } | null;
};

export type Transfer = { afterLessonId: string; toLessonId: string; toTitle: string; toStartsAt: Date; verdict: TransferVerdict };

/**
 * Переходы к очным парам одного дня (отменённые пропускаем). Откуда идти — последний корпус, где студент был очно;
 * перерыв — от конца предыдущего занятия, в том числе онлайн: онлайн-пара между очными не свободное время
 * (ревью Codex 66). Возвращает словарь «id занятия → переход после него». Пары в одном корпусе — только
 * с { sameBuilding: true }: плашке на «Сегодня» они не нужны, а помощнице нужен посчитанный перерыв и там.
 */
export function transfersForDay(lessons: LessonLike[], opts: { sameBuilding?: boolean } = {}): Map<string, Transfer> {
  const result = new Map<string, Transfer>();
  const day = lessons.filter((l) => l.status !== "CANCELLED").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  let place: LessonLike["building"] = null; // где студент очно; после очной пары без корпуса — неизвестно

  for (let i = 0; i + 1 < day.length; i++) {
    const cur = day[i];
    const next = day[i + 1];
    if (!cur.online) place = cur.building;
    if (next.online || !next.building || !place) continue;
    const gapMin = Math.round((next.startsAt.getTime() - cur.endsAt.getTime()) / 60_000);
    if (gapMin < 0 || gapMin > 120) continue; // пересечение или длинное окно — не переход
    const verdict = judgeTransfer(place, next.building, gapMin);
    if (verdict.kind !== "same-building" || opts.sameBuilding) {
      result.set(cur.id, { afterLessonId: cur.id, toLessonId: next.id, toTitle: next.building.title, toStartsAt: next.startsAt, verdict });
    }
  }
  return result;
}

/** Текст перехода: один и тот же на плашке «Сегодня» и в снимке помощницы. */
export function transferText(v: TransferVerdict): string {
  switch (v.kind) {
    case "same-building":
      return `Тот же корпус, перерыв ${v.gapMin} мин.`;
    case "impossible":
      return `Не успеть: перерыв ${v.gapMin} мин, а дорога ≈ ${v.estimate.transitMin} мин на транспорте. Предупредите преподавателя или подайте заявку.`;
    case "tight":
      return `Впритык: перерыв ${v.gapMin} мин, транспортом ≈ ${v.estimate.transitMin} мин.`;
    case "ok":
      return v.mode === "walk"
        ? `Пешком ≈ ${v.estimate.walkMin} мин, перерыв ${v.gapMin} мин.`
        : `Транспортом ≈ ${v.estimate.transitMin} мин, перерыв ${v.gapMin} мин.`;
  }
}
