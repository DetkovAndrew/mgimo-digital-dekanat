"use client";

import { useActionState } from "react";
import type { FieldSpec } from "@/lib/requests/catalog";
import { submitRequest, type FormState } from "../actions";

const inputClass =
  "w-full rounded-xl border border-field bg-surface px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function RequestForm({ type, fields, defaults = {} }: { type: string; fields: FieldSpec[]; defaults?: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitRequest.bind(null, type), {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {fields.map((f) => {
        const error = state.fieldErrors?.[f.name]?.[0];
        if (f.kind === "select") {
          // Вариантов мало (2–5): видимые варианты вместо нативного списка, одно касание вместо двух.
          return (
            <fieldset key={f.name} aria-describedby={error ? `${f.name}-error` : f.hint ? `${f.name}-hint` : undefined}>
              <legend className="mb-1 block text-sm font-medium">
                {f.label}
                {f.optional && <span className="font-normal text-ink-3"> (необязательно)</span>}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {f.options?.map((o) => (
                  <label
                    key={o.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/20 ${error ? "border-bad" : "border-field"}`}
                  >
                    <input type="radio" name={f.name} value={o.value} defaultChecked={defaults[f.name] === o.value} required={!f.optional} className="size-4 shrink-0 accent-brand-fill" />
                    {o.label}
                  </label>
                ))}
              </div>
              {f.hint && !error && (
                <p id={`${f.name}-hint`} className="mt-1 text-xs text-ink-2">
                  {f.hint}
                </p>
              )}
              {error && (
                <p id={`${f.name}-error`} className="mt-1 text-xs text-bad">
                  {error}
                </p>
              )}
            </fieldset>
          );
        }
        const common = {
          id: f.name,
          name: f.name,
          required: !f.optional,
          "aria-invalid": Boolean(error),
          "aria-describedby": error ? `${f.name}-error` : undefined,
          className: inputClass,
        };
        return (
          <div key={f.name}>
            <label htmlFor={f.name} className="mb-1 block text-sm font-medium">
              {f.label}
              {f.optional && <span className="font-normal text-ink-3"> (необязательно)</span>}
            </label>
            {f.kind === "textarea" ? (
              <textarea rows={4} defaultValue={defaults[f.name]} {...common} />
            ) : (
              <input type={f.kind === "text" ? "text" : f.kind} min={f.kind === "number" ? 1 : undefined} defaultValue={defaults[f.name]} {...common} />
            )}
            {f.hint && !error && <p className="mt-1 text-xs text-ink-2">{f.hint}</p>}
            {error && (
              <p id={`${f.name}-error`} className="mt-1 text-xs text-bad">
                {error}
              </p>
            )}
          </div>
        );
      })}
      {state.formError && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.formError}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-brand-fill px-4 py-3 font-medium text-on-brand hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Отправляем…" : "Отправить в деканат"}
      </button>
    </form>
  );
}
