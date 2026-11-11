import type { Transfer } from "@/lib/transfers";

/** Плашка между парами: успеет ли студент дойти до следующего корпуса. */
export function TransferNote({ transfer }: { transfer: Transfer }) {
  const v = transfer.verdict;
  if (v.kind === "same-building") return null;
  const tone =
    v.kind === "impossible"
      ? "border-bad/30 bg-bad-soft text-bad"
      : v.kind === "tight"
        ? "border-warn/30 bg-warn-soft text-warn"
        : "border-hairline bg-fill text-ink-2";
  const text =
    v.kind === "impossible"
      ? `Не успеть: перерыв ${v.gapMin} мин, а дорога ≈ ${v.estimate.transitMin} мин на транспорте. Предупредите преподавателя или подайте заявку.`
      : v.kind === "tight"
        ? `Впритык: перерыв ${v.gapMin} мин, транспортом ≈ ${v.estimate.transitMin} мин.`
        : v.mode === "walk"
          ? `Пешком ≈ ${v.estimate.walkMin} мин, перерыв ${v.gapMin} мин.`
          : `Транспортом ≈ ${v.estimate.transitMin} мин, перерыв ${v.gapMin} мин.`;

  return (
    <p className={`ml-4 flex items-start gap-2 rounded-xl border border-dashed px-3 py-2 text-xs ${tone}`}>
      <span aria-hidden>{v.kind === "impossible" ? "⚠" : v.kind === "tight" ? "⏱" : "↓"}</span>
      <span>
        <b>Переход → {transfer.toTitle}.</b> {text} <span className="opacity-70">Оценка примерная.</span>
      </span>
    </p>
  );
}
