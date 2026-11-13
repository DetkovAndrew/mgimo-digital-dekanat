"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useActionState, useState } from "react";
import { allowedTransitions, needsComment, type StaffActionState, type StaffRequestStatus } from "@/lib/staff/requests";
import { changeRequestAction } from "../../actions";

const labels: Partial<Record<StaffRequestStatus, string>> = {
  IN_PROGRESS: "Взять в работу", NEEDS_INFO: "Запросить уточнение", READY: "Отметить готовой", REJECTED: "Отклонить", DONE: "Отметить исполненной",
};

export function RequestActions({ id, status }: { id: string; status: StaffRequestStatus }) {
  // Ответ студента переводит NEEDS_INFO в SUBMITTED — до этого можно только отклонить.
  const options = allowedTransitions(status).filter((to) => !(status === "NEEDS_INFO" && to === "IN_PROGRESS"));
  const [target, setTarget] = useState<StaffRequestStatus | undefined>(options[0]);
  const [state, action, pending] = useActionState<StaffActionState, FormData>(changeRequestAction, { ok: false });
  if (!options.length) return <p className="text-body text-ink-2">Заявка завершена. Дальнейших действий нет.</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="fromStatus" value={status} />
      {status === "NEEDS_INFO" && <p className="text-body text-ink-2">Ожидается ответ студента. После ответа заявка вернётся в «Новые», а ответ появится в истории.</p>}
      <fieldset disabled={pending}>
        <legend className="mb-2 text-body font-medium">Что сделать</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((to) => (
            <label key={to} className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-body ${target === to ? "bg-brand-soft font-medium text-ink ring-2 ring-brand" : "bg-page text-ink ring-1 ring-hairline"} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand`}>
              <input type="radio" name="toStatus" value={to} checked={target === to} onChange={() => setTarget(to)} className="sr-only" required />
              {labels[to]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="staff-comment" className="mb-1 block text-body font-medium">Комментарий студенту{target && needsComment(target) ? " (обязательно)" : " (необязательно)"}</label>
        <textarea id="staff-comment" name="comment" rows={4} maxLength={500} required={target !== undefined && needsComment(target)} disabled={pending}
          aria-describedby="staff-comment-hint" className="w-full resize-y rounded-xl border border-hairline bg-page px-3 py-2 text-body text-ink" />
        <p id="staff-comment-hint" className="mt-1 text-body text-ink-2">До 500 символов. Комментарий будет виден студенту в истории и уведомлении.</p>
      </div>
      {state.message && <p role={state.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-body ${state.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{state.message}</p>}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-fill px-4 py-3 text-body font-semibold text-on-brand disabled:bg-fill disabled:text-ink-3">
        {pending ? <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden className="size-5" />}
        {pending ? "Сохраняем…" : "Применить статус"}
      </button>
    </form>
  );
}
