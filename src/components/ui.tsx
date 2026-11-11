import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/format";
import { Chevron } from "./pending";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.04] ${className}`}>{children}</section>;
}

export function PageTitle({ children, aside, sub }: { children: ReactNode; aside?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{children}</h1>
        {aside}
      </div>
      {sub && <p className="mt-0.5 text-sm text-slate-500 first-letter:uppercase">{sub}</p>}
    </div>
  );
}

/** Подпись раздела: мелко и спокойно, чтобы не спорить с содержимым. */
export function Section({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-6 ${className}`}>
      {(title || aside) && (
        <div className="mb-2 flex min-h-6 items-center justify-between gap-3 px-1">
          {title && <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Группа строк в одной карточке, с разделителями. */
export function List({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.04]">
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
        className="group flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors active:bg-slate-50 md:hover:bg-slate-50/70"
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
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-blue-50 text-blue-700",
  warn: "bg-amber-50 text-amber-800",
  ok: "bg-emerald-50 text-emerald-700",
  bad: "bg-red-50 text-red-700",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-white/60 p-6 text-center text-sm text-slate-500 ring-1 ring-black/[0.04]">{children}</p>;
}
