"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export type FilterItem = { href: string; text: string; on: boolean; sub?: string };

/**
 * Один фильтр «Найти свободную»: кнопка с текущим значением, по нажатию — список вариантов.
 * Варианты — обычные ссылки, как и раньше: выбор сразу меняет адрес и результат. Закрывается выбором,
 * нажатием мимо и Escape.
 */
export function FilterMenu({ label, items, align = "left" }: { label: string; items: FilterItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = items.find((i) => i.on) ?? items[0];

  useEffect(() => {
    if (!open) return;
    // Текущий вариант сразу на виду: в длинном списке времени не приходится листать.
    list.current?.querySelector<HTMLElement>("[aria-current]")?.scrollIntoView({ block: "nearest" });
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-14 w-full items-center gap-2 rounded-xl px-3 text-left transition-colors ${
          open ? "bg-surface ring-2 ring-brand" : "bg-surface ring-1 ring-hairline hover:ring-brand/40"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-micro text-ink-2">{label}</span>
          <span className="block truncate text-sm font-semibold tabular-nums">
            {current?.text}
            {current?.sub && <span className="font-normal text-ink-2">, {current.sub}</span>}
          </span>
        </span>
        <ChevronDown aria-hidden className={`size-4 shrink-0 text-ink-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          aria-label={label}
          className={`absolute top-full z-30 mt-1 max-h-72 w-max min-w-full max-w-[min(18rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl bg-surface p-1 ring-1 ring-hairline ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                replace
                scroll={false}
                aria-current={i.on ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm tabular-nums transition-colors ${
                  i.on ? "bg-brand-soft font-semibold text-brand" : "text-ink hover:bg-fill"
                }`}
              >
                <span className="flex-1">
                  {i.text}
                  {i.sub && <span className={i.on ? "" : "text-ink-2"}>, {i.sub}</span>}
                </span>
                {i.on && <Check aria-hidden className="size-4 shrink-0" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
