"use client";

import { useActionState } from "react";
import type { FieldSpec } from "@/lib/requests/catalog";
import { submitRequest, type FormState } from "../actions";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function RequestForm({ type, fields }: { type: string; fields: FieldSpec[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitRequest.bind(null, type), {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {fields.map((f) => {
        const error = state.fieldErrors?.[f.name]?.[0];
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
              {f.optional && <span className="font-normal text-slate-400"> (необязательно)</span>}
            </label>
            {f.kind === "textarea" ? (
              <textarea rows={4} {...common} />
            ) : f.kind === "select" ? (
              <select {...common} defaultValue="">
                <option value="" disabled>
                  Выберите…
                </option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input type={f.kind === "text" ? "text" : f.kind} min={f.kind === "number" ? 1 : undefined} {...common} />
            )}
            {f.hint && !error && <p className="mt-1 text-xs text-slate-500">{f.hint}</p>}
            {error && (
              <p id={`${f.name}-error`} className="mt-1 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>
        );
      })}
      {state.formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.formError}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Отправляем…" : "Отправить в деканат"}
      </button>
    </form>
  );
}
