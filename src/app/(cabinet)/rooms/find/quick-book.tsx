"use client";

import { CalendarCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "@/components/toast";
import { ROOM_RULES } from "@/lib/campus/rules";
import { bookRoomAction } from "../actions";

/** Бронь из списка свободных: одно касание открывает цель (уже заполнена), второе бронирует. */
export function QuickBook({ roomId, day, start, minutes, label }: { roomId: string; day: string; start: string; minutes: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("Самостоятельная работа");
  const [done, setDone] = useState(false);
  const [pending, run] = useTransition();

  if (done)
    return (
      <p role="status" className="mt-3 flex flex-wrap items-center gap-x-2 rounded-xl bg-ok-soft px-3 py-2.5 text-sm text-ok">
        <CalendarCheck aria-hidden className="size-4" />
        Забронировано {label}.
        <Link href="/rooms" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          Мои брони
        </Link>
      </p>
    );

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-soft px-4 text-sm font-semibold text-brand transition active:scale-[0.98]"
      >
        <CalendarCheck aria-hidden className="size-4" />
        Забронировать {label}
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await bookRoomAction({ roomId, day, start, minutes, purpose });
          toast(r.ok, r.ok ? r.message : r.error);
          if (r.ok) setDone(true);
        });
      }}
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <label className="min-w-0 flex-1 text-sm">
        <span className="mb-1 block text-ink-2">Для чего</span>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          maxLength={ROOM_RULES.purposeMax}
          autoFocus
          className="min-h-11 w-full rounded-xl bg-surface px-3 text-body ring-1 ring-field outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </label>
      <button
        type="submit"
        disabled={pending || purpose.trim().length < 2}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-fill px-4 text-sm font-semibold text-on-brand transition active:scale-[0.98] disabled:bg-fill disabled:text-ink-3"
      >
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
        Подтвердить
      </button>
    </form>
  );
}
