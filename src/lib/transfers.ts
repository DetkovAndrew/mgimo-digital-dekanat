import { judgeTransfer, type TransferVerdict } from "./geo";

type LessonLike = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  online: boolean;
  building: { id: string; lat: number; lon: number; title: string } | null;
};

export type Transfer = { afterLessonId: string; toTitle: string; toStartsAt: Date; verdict: TransferVerdict };

/**
 * Переходы между соседними очными парами одного дня (отменённые и онлайн пропускаем).
 * Возвращает словарь «id пары → переход после неё».
 */
export function transfersForDay(lessons: LessonLike[]): Map<string, Transfer> {
  const result = new Map<string, Transfer>();
  const inPerson = lessons
    .filter((l) => l.status !== "CANCELLED" && !l.online && l.building)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  for (let i = 0; i + 1 < inPerson.length; i++) {
    const from = inPerson[i];
    const to = inPerson[i + 1];
    const gapMin = Math.round((to.startsAt.getTime() - from.endsAt.getTime()) / 60_000);
    if (gapMin < 0 || gapMin > 120) continue; // пересечение или длинное окно — не переход
    const verdict = judgeTransfer(from.building!, to.building!, gapMin);
    if (verdict.kind !== "same-building") {
      result.set(from.id, { afterLessonId: from.id, toTitle: to.building!.title, toStartsAt: to.startsAt, verdict });
    }
  }
  return result;
}
