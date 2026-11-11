import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/format";
import { Chevron } from "./pending";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-surface p-4 ring-1 ring-hairline ${className}`}>{children}</section>;
}

export function PageTitle({ children, aside, sub }: { children: ReactNode; aside?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{children}</h1>
        {aside}
      </div>
      {sub && <p className="mt-0.5 text-sm text-ink-2 first-letter:uppercase">{sub}</p>}
    </div>
  );
}

/** Подпись раздела: мелко и спокойно, чтобы не спорить с содержимым. */
export function Section({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-6 ${className}`}>
      {(title || aside) && (
        <div className="mb-2 flex min-h-6 items-center justify-between gap-3 px-1">
          {title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Свёрнутый раздел: заголовок со стрелкой, которая поворачивается при раскрытии. */
export function Disclosure({ title, children, open, className = "mb-6" }: { title: ReactNode; children: ReactNode; open?: boolean; className?: string }) {
  return (
    <details open={open} className={`group ${className}`}>
      <summary className="mb-2 flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-1 text-[17px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden className="size-4 text-ink-3 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      {children}
    </details>
  );
}

/** Группа строк в одной карточке, с разделителями. */
export function List({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
      {children}
    </ul>
  );
}

/** Строка-ссылка вглубь: вся строка нажимается, стрелка показывает загрузку. */
export function RowLink({ href, children, back = false }: { href: string; children: ReactNode; back?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        transitionTypes={[back ? "nav-back" : "nav-forward"]}
        className="group flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors focus-visible:-outline-offset-2 active:bg-fill md:hover:bg-fill/70"
      >
        <span className="min-w-0 flex-1">{children}</span>
        <Chevron />
      </Link>
    </li>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <li className="flex min-h-14 items-center gap-3 px-4 py-2.5">{children}</li>;
}

const tones: Record<Tone, string> = {
  neutral: "bg-fill text-ink-2",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-surface/60 p-6 text-center text-sm text-ink-2 ring-1 ring-hairline">{children}</p>;
}
