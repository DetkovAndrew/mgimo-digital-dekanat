"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelBooking, demoDraw } from "./actions";

export function DemoDrawButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Демо: провести жеребьёвку ближайшей открытой недели сейчас? Повторить её будет нельзя.")) return;
          start(async () => {
            const r = await demoDraw();
            setMessage(r.ok ? { ok: true, text: r.message ?? "Готово" } : { ok: false, text: r.error });
            router.refresh();
          });
        }}
        className="min-h-11 rounded-xl border border-dashed border-brand/50 px-4 text-sm font-medium text-brand disabled:opacity-50"
      >
        {pending ? "Проводим жеребьёвку…" : "Демо: провести жеребьёвку сейчас"}
      </button>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

export function CancelBookingButton({ id, waitlist }: { id: string; waitlist: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(waitlist ? "Выйти из листа ожидания?" : "Отменить запись? Место перейдёт следующему в очереди.")) return;
          start(async () => {
            const r = await cancelBooking(id);
            setError(r.ok ? null : r.error);
            router.refresh();
          });
        }}
        className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "…" : waitlist ? "Выйти" : "Отменить"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </>
  );
}
