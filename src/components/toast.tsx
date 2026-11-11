"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";

type Toast = { id: number; ok: boolean; text: string };

/** Показать короткое сообщение внизу экрана (над нижним меню). */
export function toast(ok: boolean, text: string) {
  window.dispatchEvent(new CustomEvent<Omit<Toast, "id">>("app-toast", { detail: { ok, text } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = { id: Date.now(), ...(e as CustomEvent<Omit<Toast, "id">>).detail };
      setItems((xs) => [...xs.slice(-1), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3500);
    };
    window.addEventListener("app-toast", on);
    return () => window.removeEventListener("app-toast", on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((t) => (
        <p
          key={t.id}
          role="status"
          className="flex max-w-md animate-[toast-in_260ms_var(--ease-out)] motion-reduce:animate-none items-start gap-2 rounded-2xl bg-slate-900/95 px-4 py-3 text-sm text-white shadow-lg backdrop-blur"
        >
          {t.ok ? (
            <CircleCheck aria-hidden className="mt-px size-4 shrink-0 text-emerald-400" />
          ) : (
            <CircleAlert aria-hidden className="mt-px size-4 shrink-0 text-amber-400" />
          )}
          {t.text}
        </p>
      ))}
    </div>
  );
}
