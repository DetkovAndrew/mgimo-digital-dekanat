"use client";

import { useActionState } from "react";
import { answerRequest, type FormState } from "../actions";

export function AnswerForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(answerRequest.bind(null, id), {});
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="comment" className="sr-only">
        Ваш ответ
      </label>
      <textarea
        id="comment"
        name="comment"
        rows={3}
        required
        placeholder="Ваш ответ деканату"
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {state.formError && <p className="text-xs text-red-600">{state.formError}</p>}
      <button disabled={pending} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Отправляем…" : "Ответить"}
      </button>
    </form>
  );
}
