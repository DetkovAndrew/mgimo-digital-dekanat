import type { Tone } from "./format";

// Шкала University по мотивам БаРС: 100 основных баллов (+ до 3 дополнительных).
// Пороги — демонстрационное правило University, не официальный документ вуза.

export const PASS_POINTS = 60;
export const MAX_POINTS = 100;

export type Ects = "A" | "B" | "C" | "D" | "E" | "FX";
export type ScaleBand = { ects: Ects; grade: 2 | 3 | 4 | 5; from: number; label: string };

/** Нижние границы диапазонов (включительно), от лучшего к худшему. */
export const SCALE: readonly ScaleBand[] = [
  { ects: "A", grade: 5, from: 91, label: "отлично" },
  { ects: "B", grade: 4, from: 84, label: "очень хорошо" },
  { ects: "C", grade: 4, from: 75, label: "хорошо" },
  { ects: "D", grade: 3, from: 68, label: "удовлетворительно" },
  { ects: "E", grade: 3, from: 60, label: "посредственно" },
  { ects: "FX", grade: 2, from: 0, label: "неудовлетворительно" },
];

export function bandFor(points: number): ScaleBand {
  return SCALE.find((b) => points >= b.from) ?? SCALE[SCALE.length - 1];
}

export type Checkpoint = {
  maxPoints: number;
  points: number | null;
  isFinal: boolean;
  /** Срок сдачи или дата проведения; null — без даты. */
  date?: Date | null;
};

export type DisciplineProgress = {
  earned: number; // набрано
  pending: number; // срок прошёл, оценки ещё нет (на проверке)
  remaining: number; // будущие точки, включая аттестацию
  band: ScaleBand; // по набранному сейчас — не путать с итоговой оценкой аттестации
  toPass: number; // сколько не хватает до 60 (0 — уже есть)
  passReachable: boolean; // хватит ли до 60 даже максимума за оставшиеся и проверяемые точки
};

/** Только арифметика по уже известным баллам, без прогнозов «при том же темпе». */
export function disciplineProgress(points: Checkpoint[], now = new Date()): DisciplineProgress {
  let earned = 0;
  let pending = 0;
  let remaining = 0;
  for (const p of points) {
    if (p.points !== null) earned += p.points;
    else if (p.date && p.date < now && !p.isFinal) pending += p.maxPoints;
    else remaining += p.maxPoints;
  }
  const toPass = Math.max(0, PASS_POINTS - earned);
  return { earned, pending, remaining, band: bandFor(earned), toPass, passReachable: toPass <= remaining + pending };
}

export const formatPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/** Контрольная точка или аттестация в том виде, в каком её отдаёт DAL (результаты — только свои). */
export type AssessmentLike = {
  kind: string;
  dueAt: Date | null;
  scheduledAt: Date | null;
  maxPoints: number | null;
  results: { points: number | null; passed: boolean | null; grade: number | null }[];
};

/** Единое правило даты точки: срок сдачи, а если его нет — дата проведения. */
export const assessmentDate = (a: Pick<AssessmentLike, "dueAt" | "scheduledAt">) => a.dueAt ?? a.scheduledAt ?? null;

export function courseProgress(controlForm: string, assessments: AssessmentLike[], now = new Date()) {
  return disciplineProgress(
    assessments.map((a) => ({
      maxPoints: a.maxPoints ?? 0,
      points: a.results.at(-1)?.points ?? null,
      isFinal: a.kind === controlForm,
      date: assessmentDate(a),
    })),
    now,
  );
}


/** Выставленный итог аттестации: «зачтено/не зачтено» или оценка. Баллы без них — ещё не итог. */
export function officialResult(controlForm: string, assessments: AssessmentLike[]) {
  const last = assessments.find((a) => a.kind === controlForm)?.results.at(-1);
  if (last?.passed != null) return { passed: last.passed, grade: null };
  if (last?.grade != null) return { passed: last.grade >= 3, grade: last.grade };
  return null;
}

/**
 * Статус дисциплины. Итог берём только из результата аттестации (оценка или «зачтено»);
 * до него — арифметика по баллам, без шкалы: 30 баллов посреди семестра — не «FX» (ревью Codex 10, 11).
 */
export function courseStatus(controlForm: string, assessments: AssessmentLike[], now = new Date()): { tone: Tone; text: string } {
  const official = officialResult(controlForm, assessments);
  if (official?.grade != null) {
    // Цифрой, как в зачётке, и буквой ECTS по баллам — если буква согласуется с выставленной оценкой («5 · A»).
    const band = bandFor(courseProgress(controlForm, assessments, now).earned);
    const text = band.grade === official.grade ? `${official.grade} · ${band.ects}` : String(official.grade);
    return { tone: official.grade >= 4 ? "ok" : official.grade === 3 ? "info" : "bad", text };
  }
  if (official) return official.passed ? { tone: "ok", text: "зачтено" } : { tone: "bad", text: "не зачтено" };
  const p = courseProgress(controlForm, assessments, now);
  if (p.toPass === 0) return { tone: "ok", text: `порог ${PASS_POINTS} пройден` };
  if (!p.passReachable) return { tone: "bad", text: `до ${PASS_POINTS} не добрать` };
  return { tone: "neutral", text: `до ${PASS_POINTS} ещё ${formatPoints(p.toPass)}` };
}

/** Ближайшая по дате несданная точка (работа или аттестация); точки без даты — в конце. */
export function nextAssessment<A extends AssessmentLike>(assessments: A[], now = new Date()): A | null {
  return (
    assessments
      .filter((a) => !a.results.length && (assessmentDate(a) ?? now) >= now)
      .sort((x, y) => (assessmentDate(x)?.getTime() ?? Infinity) - (assessmentDate(y)?.getTime() ?? Infinity))[0] ?? null
  );
}
