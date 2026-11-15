import { BookOpen, Dumbbell, Languages, type LucideIcon, MessagesSquare, Presentation, Users } from "lucide-react";

// Тип занятия → цвет и иконка. Классы записаны целиком: Tailwind собирает только то, что видит в исходниках.
type KindStyle = { text: string; soft: string; bar: string; icon: LucideIcon };
const KINDS: Record<string, KindStyle> = {
  LECTURE: { text: "text-k-lecture", soft: "bg-k-lecture-soft", bar: "bg-k-lecture", icon: Presentation },
  SEMINAR: { text: "text-k-practice", soft: "bg-k-practice-soft", bar: "bg-k-practice", icon: Users },
  PRACTICE: { text: "text-k-practice", soft: "bg-k-practice-soft", bar: "bg-k-practice", icon: BookOpen },
  LANGUAGE: { text: "text-k-language", soft: "bg-k-language-soft", bar: "bg-k-language", icon: Languages },
  CONSULTATION: { text: "text-k-consult", soft: "bg-k-consult-soft", bar: "bg-k-consult", icon: MessagesSquare },
  SPORT: { text: "text-k-sport", soft: "bg-k-sport-soft", bar: "bg-k-sport", icon: Dumbbell },
};

export const kindStyle = (kind: string): KindStyle => KINDS[kind] ?? KINDS.LECTURE;

/** Блок времени, окрашенный типом занятия: цвет читается быстрее подписи. */
export function KindTime({ kind, start, end, struck }: { kind: string; start: string; end?: string; struck?: boolean }) {
  const k = kindStyle(kind);
  return (
    <span className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-2 ${k.soft} ${k.text}`}>
      <span className={`text-[15px] leading-tight font-bold tabular-nums ${struck ? "line-through" : ""}`}>{start}</span>
      {end && <span className="text-[11px] leading-tight font-medium tabular-nums">{end}</span>}
    </span>
  );
}

/** Плитка с иконкой типа занятия — для строк, где время показано текстом. */
export function KindTile({ kind }: { kind: string }) {
  const k = kindStyle(kind);
  const Icon = k.icon;
  return (
    <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl ${k.soft} ${k.text}`}>
      <Icon className="size-5" />
    </span>
  );
}
