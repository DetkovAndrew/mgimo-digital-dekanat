"use client";

import { LoaderCircle, MegaphoneOff } from "lucide-react";
import { useActionState, useState } from "react";
import type { AnnounceActionState } from "@/lib/staff/announcements";
import { withdrawAnnouncementAction } from "../actions";

/** Отзыв объявления в два касания: первое спрашивает, второе отзывает у всех получателей. */
export function WithdrawButton({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState<AnnounceActionState, FormData>(withdrawAnnouncementAction, { ok: false });
  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-body font-medium text-ink-2 ring-1 ring-hairline">
        <MegaphoneOff aria-hidden className="size-4" />
        Отозвать
      </button>
    );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-body">Отозвать у всех получателей?</span>
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-bad-fill px-3 text-body font-semibold text-on-brand disabled:bg-fill disabled:text-ink-3">
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
        {pending ? "Отзываем…" : "Да, отозвать"}
      </button>
      <button type="button" disabled={pending} onClick={() => setAsking(false)} className="inline-flex min-h-11 items-center rounded-xl px-3 text-body font-medium text-ink-2 ring-1 ring-hairline">
        Нет
      </button>
      {state.message && <p role={state.ok ? "status" : "alert"} className={`w-full rounded-xl px-3 py-2 text-body ${state.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{state.message}</p>}
    </form>
  );
}
