"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useActionState, useState } from "react";
import type { AnnounceActionState } from "@/lib/staff/announcements";
import { sendAnnouncementAction } from "../actions";

const field = "min-h-11 w-full rounded-xl border border-hairline bg-page px-3 py-2 text-body text-ink";

/** Кому, заголовок, текст, «важное». После отправки форма очищается, чтобы случайно не отправить дважды. */
export function AnnouncementForm({ groups, courses }: { groups: string[]; courses: number[] }) {
  const [audience, setAudience] = useState<"faculty" | "course" | "group">("faculty");
  const [state, action, pending] = useActionState<AnnounceActionState, FormData>(sendAnnouncementAction, { ok: false });
  return (
    <form action={action} key={state.ok ? state.message : "form"} className="space-y-4">
      <fieldset disabled={pending}>
        <legend className="mb-2 text-body font-medium">Кому</legend>
        <div className="flex flex-wrap gap-2">
          {([["faculty", "Всему факультету"], ["course", "Курсу"], ["group", "Группе"]] as const).map(([v, label]) => (
            <label key={v} className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-body ${audience === v ? "bg-brand-soft font-medium text-ink ring-2 ring-brand" : "bg-page text-ink ring-1 ring-hairline"} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand`}>
              <input type="radio" name="audience" value={v} checked={audience === v} onChange={() => setAudience(v)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {audience === "course" && (
        <label className="block">
          <span className="mb-1 block text-body font-medium">Курс</span>
          <select name="course" required className={field} disabled={pending}>
            {courses.map((c) => (
              <option key={c} value={c}>{c} курс</option>
            ))}
          </select>
        </label>
      )}
      {audience === "group" && (
        <label className="block">
          <span className="mb-1 block text-body font-medium">Группа</span>
          <select name="group" required className={field} disabled={pending}>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-body font-medium">Заголовок</span>
        <input name="title" required minLength={3} maxLength={80} disabled={pending} className={field} placeholder="Например: Консультация перед экзаменом" />
      </label>
      <label className="block">
        <span className="mb-1 block text-body font-medium">Текст</span>
        <textarea name="body" rows={5} required minLength={10} maxLength={1000} disabled={pending} className="w-full resize-y rounded-xl border border-hairline bg-page px-3 py-2 text-body text-ink" />
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body">
        <input type="checkbox" name="important" disabled={pending} className="size-5 accent-brand" />
        Важное — выделить у студентов
      </label>
      {state.message && <p role={state.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-body ${state.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{state.message}</p>}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-fill px-4 py-3 text-body font-semibold text-on-brand disabled:bg-fill disabled:text-ink-3">
        {pending ? <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" /> : <Send aria-hidden className="size-5" />}
        {pending ? "Отправляем…" : "Отправить объявление"}
      </button>
    </form>
  );
}
