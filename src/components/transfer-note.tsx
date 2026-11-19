import { ArrowDown, Timer, TriangleAlert } from "lucide-react";
import { type Transfer, transferText } from "@/lib/transfers";

/**
 * Плашка между парами: успеет ли студент дойти до следующего корпуса. Фон у всех спокойный, как у обычного перехода:
 * сплошной красный и оранжевый резали глаз среди карточек пар (NursuUwU, 19.11). Тревогу несут иконка, заголовок и рамка.
 */
export function TransferNote({ transfer }: { transfer: Transfer }) {
  const v = transfer.verdict;
  if (v.kind === "same-building") return null;
  const tone = v.kind === "impossible" ? { border: "border-bad/45", accent: "text-bad" } : v.kind === "tight" ? { border: "border-warn/45", accent: "text-warn" } : { border: "border-hairline", accent: "" };
  const text = transferText(v);
  const Icon = v.kind === "impossible" ? TriangleAlert : v.kind === "tight" ? Timer : ArrowDown;

  return (
    <p className={`ml-4 flex items-start gap-2 rounded-xl border border-dashed bg-fill px-3 py-2 text-xs text-ink-2 ${tone.border}`}>
      <Icon aria-hidden className={`mt-px size-3.5 shrink-0 ${tone.accent}`} />
      <span>
        <b className={tone.accent}>Переход → {transfer.toTitle}.</b> {text}
      </span>
    </p>
  );
}
