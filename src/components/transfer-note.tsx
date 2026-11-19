import { ArrowDown, Timer, TriangleAlert } from "lucide-react";
import { type Transfer, transferText } from "@/lib/transfers";

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
  const text = transferText(v);

  return (
    <p className={`ml-4 flex items-start gap-2 rounded-xl border border-dashed px-3 py-2 text-xs ${tone}`}>
      {(() => {
        const Icon = v.kind === "impossible" ? TriangleAlert : v.kind === "tight" ? Timer : ArrowDown;
        return <Icon aria-hidden className="mt-px size-3.5 shrink-0" />;
      })()}
      <span>
        <b>Переход в корпус {transfer.toTitle}.</b> {text}
      </span>
    </p>
  );
}
