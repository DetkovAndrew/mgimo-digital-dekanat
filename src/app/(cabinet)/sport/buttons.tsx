"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useTransition } from "react";
import { toast } from "@/components/toast";
import { book, cancelBooking } from "./actions";

const base = "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 disabled:opacity-60";

/** Одна кнопка на тренировку: «Записаться» или «В очередь». Результат — сразу в списке и всплывающим сообщением. */
export function BookButton({ slotId, queue }: { slotId: string; queue: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await book(slotId, queue);
          toast(r.ok, r.ok ? r.message : r.error);
        })
      }
      className={`${base} ${queue ? "bg-white text-brand ring-1 ring-brand/30" : "bg-brand text-white shadow-sm shadow-brand/30"}`}
    >
      {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {queue ? "В очередь" : "Записаться"}
    </button>
  );
}

export function Booked({ queued }: { queued: boolean }) {
  return (
    <span className={`${base} px-3 ${queued ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
      {!queued && <Check aria-hidden className="size-4" />}
      {queued ? "В очереди" : "Вы записаны"}
    </span>
  );
}

export function CancelBookingButton({ id, waitlist }: { id: string; waitlist: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(waitlist ? "Выйти из очереди?" : "Отменить запись? Место получит следующий в очереди.")) return;
        start(async () => {
          const r = await cancelBooking(id);
          toast(r.ok, r.ok ? r.message : r.error);
        });
      }}
      className="min-h-11 shrink-0 rounded-full px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-95 disabled:opacity-50"
    >
      {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : waitlist ? "Выйти" : "Отменить"}
    </button>
  );
}
