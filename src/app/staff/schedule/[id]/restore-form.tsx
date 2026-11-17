"use client";

import { LoaderCircle, Undo2 } from "lucide-react";
import { useActionState } from "react";
import type { ScheduleActionState } from "@/lib/staff/schedule";
import { rescheduleLessonAction } from "../../actions";

/** «Вернуть как было»: пара снова в исходное время и место, группе уведомление. Аккаунт сотрудника общий для жюри. */
export function RestoreForm({ id, expected, was }: { id: string; expected: string; was: string }) {
  const [state, action, pending] = useActionState<ScheduleActionState, FormData>(rescheduleLessonAction, { ok: false });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="action" value="restore" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expected" value={expected} />
      <p className="text-body">
        До изменений деканата: <span className="font-medium first-letter:uppercase">{was}</span>
      </p>
      {state.message && <p role={state.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-body ${state.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{state.message}</p>}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 text-body font-semibold text-ink ring-1 ring-hairline disabled:bg-fill disabled:text-ink-3">
        {pending ? <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" /> : <Undo2 aria-hidden className="size-5" />}
        {pending ? "Возвращаем…" : "Вернуть как было и уведомить группу"}
      </button>
    </form>
  );
}
