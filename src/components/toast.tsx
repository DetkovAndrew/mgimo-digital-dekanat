"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Action = { label: string; run: () => void };
type Toast = { id: number; ok: boolean; text: string; action?: Action };

/**
 * Показать короткое сообщение внизу экрана (над нижним меню). action: кнопка в сообщении («Вернуть» после удаления):
 * такое сообщение висит дольше и не исчезает, пока на нём курсор или фокус (ревью Codex 90).
 */
export function toast(ok: boolean, text: string, action?: Action) {
  window.dispatchEvent(new CustomEvent<Omit<Toast, "id">>("app-toast", { detail: { ok, text, action } }));
}

let seq = 0;

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = { id: ++seq, ...(e as CustomEvent<Omit<Toast, "id">>).detail };
      setItems((xs) => [...xs.slice(-1), t]);
    };
    window.addEventListener("app-toast", on);
    return () => window.removeEventListener("app-toast", on);
  }, []);
  const close = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  return (
    // На телефоне: над кнопкой помощницы (bottom 5.5rem + 56 px): иначе она закрывает «Вернуть» справа.
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((t) => (
        <ToastItem key={t.id} t={t} close={() => close(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ t, close }: { t: Toast; close: () => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(t.action ? 6000 : 3500);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => closeRef.current(), left.current);
    return () => {
      clearTimeout(timer);
      left.current = Math.max(1500, left.current - (Date.now() - started));
    };
  }, [paused]);

  return (
    <div
      role="status"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`flex max-w-md animate-[toast-in_260ms_var(--ease-out)] motion-reduce:animate-none items-center gap-2 rounded-2xl bg-surface text-sm text-ink shadow-lg ring-1 ring-hairline ${
        t.action ? "pointer-events-auto py-1 pr-1 pl-4" : "px-4 py-3"
      }`}
    >
      {t.ok ? <CircleCheck aria-hidden className="size-4 shrink-0 text-ok" /> : <CircleAlert aria-hidden className="size-4 shrink-0 text-warn" />}
      <span className="py-2">{t.text}</span>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            close();
            t.action!.run();
          }}
          className="min-h-11 shrink-0 rounded-xl px-3 font-semibold text-brand transition hover:bg-brand-soft active:scale-95"
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}
