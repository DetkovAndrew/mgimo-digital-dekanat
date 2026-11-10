// Шкала University по мотивам БаРС: 100 основных баллов (+ до 3 дополнительных).
// Пороги — демонстрационное правило University, не официальный документ вуза.

export const PASS_POINTS = 60;
export const MAX_POINTS = 100;
/** Прогноз показываем, только когда оценено достаточно точек, иначе он случаен. */
export const MIN_GRADED_FOR_FORECAST = 20;

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
  graded: number; // максимум за оценённые точки
  pending: number; // срок прошёл, оценки ещё нет (на проверке)
  remaining: number; // будущие точки, включая аттестацию
  remainingBeforeFinal: number; // будущие точки до аттестации
  band: ScaleBand; // по набранному сейчас
  toPass: number; // сколько не хватает до 60 (0 — уже есть)
  passReachable: boolean; // можно ли ещё добрать до 60 (с учётом точек на проверке)
  pace: number | null; // доля от максимума оценённых точек (null — оценок ещё нет)
  forecast: ScaleBand | null; // итог при том же темпе (null — мало оценок)
  atRisk: boolean; // темп ниже порога зачёта или добрать уже невозможно
};

export function disciplineProgress(points: Checkpoint[], now = new Date()): DisciplineProgress {
  let earned = 0;
  let graded = 0;
  let pending = 0;
  let remaining = 0;
  let remainingBeforeFinal = 0;
  for (const p of points) {
    if (p.points !== null) {
      earned += p.points;
      graded += p.maxPoints;
    } else if (p.date && p.date < now && !p.isFinal) {
      pending += p.maxPoints;
    } else {
      remaining += p.maxPoints;
      if (!p.isFinal) remainingBeforeFinal += p.maxPoints;
    }
  }
  const toPass = Math.max(0, PASS_POINTS - earned);
  const pace = graded > 0 ? earned / graded : null;
  const passReachable = toPass <= remaining + pending;
  return {
    earned,
    graded,
    pending,
    remaining,
    remainingBeforeFinal,
    band: bandFor(earned),
    toPass,
    passReachable,
    pace,
    forecast: pace !== null && graded >= MIN_GRADED_FOR_FORECAST ? bandFor(Math.min(MAX_POINTS, pace * MAX_POINTS)) : null,
    atRisk: toPass > 0 && (!passReachable || (pace !== null && graded >= MIN_GRADED_FOR_FORECAST && pace < PASS_POINTS / MAX_POINTS)),
  };
}

export const formatPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
