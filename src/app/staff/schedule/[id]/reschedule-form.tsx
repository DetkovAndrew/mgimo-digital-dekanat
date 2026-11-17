"use client";

import { CalendarClock, CalendarX2, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { LESSON_HOURS, type ScheduleActionState } from "@/lib/staff/schedule";
import { rescheduleLessonAction } from "../../actions";

const field = "min-h-11 w-full rounded-xl border border-hairline bg-page px-3 py-2 text-body text-ink";

/** Перенос (время и/или аудитория) или отмена пары. Причина обязательна: её увидят студенты в уведомлении. */
export function RescheduleForm({ id, expected, defaults, buildings }: {
  id: string;
  expected: string;
  defaults: { date: string; start: string; end: string; building: string; room: string };
  buildings: { id: string; title: string }[];
}) {
  const [mode, setMode] = useState<"move" | "cancel">("move");
  const [state, action, pending] = useActionState<ScheduleActionState, FormData>(rescheduleLessonAction, { ok: false });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expected" value={expected} />
      <fieldset disabled={pending}>
        <legend className="mb-2 text-body font-medium">Что сделать</legend>
        <div className="flex flex-wrap gap-2">
          {([["move", "Перенести"], ["cancel", "Отменить"]] as const).map(([v, label]) => (
            <label key={v} className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-body ${mode === v ? "bg-brand-soft font-medium text-ink ring-2 ring-brand" : "bg-page text-ink ring-1 ring-hairline"} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand`}>
              <input type="radio" name="action" value={v} checked={mode === v} onChange={() => setMode(v)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "move" && (
        <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-3">
          <legend className="sr-only">Новое время и место</legend>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-body font-medium">Дата</span>
            <input type="date" name="date" defaultValue={defaults.date} required className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-body font-medium">Начало</span>
            <input type="time" name="start" defaultValue={defaults.start} min={LESSON_HOURS.opens} max={LESSON_HOURS.closes} step={300} required className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-body font-medium">Конец</span>
            <input type="time" name="end" defaultValue={defaults.end} min={LESSON_HOURS.opens} max={LESSON_HOURS.closes} step={300} required className={field} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-body font-medium">Корпус</span>
            <select name="building" defaultValue={defaults.building} className={field}>
              <option value="">Не менять место</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-body font-medium">Аудитория</span>
            <input name="room" defaultValue={defaults.room} inputMode="numeric" pattern="\d{3,4}" placeholder="1206" className={field} />
          </label>
          <p className="text-sm text-ink-2 sm:col-span-3">
            Занятия — с {LESSON_HOURS.opens} до {LESSON_HOURS.closes}. Сервер проверит, что у группы нет другой пары, а аудитория не занята парой или бронью студента.
          </p>
        </fieldset>
      )}

      <div>
        <label htmlFor="reschedule-reason" className="mb-1 block text-body font-medium">Причина (обязательно)</label>
        <textarea id="reschedule-reason" name="reason" rows={3} maxLength={200} required minLength={5} disabled={pending} aria-describedby="reschedule-reason-hint"
          className="w-full resize-y rounded-xl border border-hairline bg-page px-3 py-2 text-body text-ink" />
        <p id="reschedule-reason-hint" className="mt-1 text-body text-ink-2">Например: «Аудитория на ремонте», «Преподаватель на конференции». Студенты увидят её в уведомлении.</p>
      </div>
      {state.message && <p role={state.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-body ${state.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{state.message}</p>}
      <button type="submit" disabled={pending} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-body font-semibold disabled:bg-fill disabled:text-ink-3 ${mode === "cancel" ? "bg-bad-fill text-on-brand" : "bg-brand-fill text-on-brand"}`}>
        {pending ? <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" /> : mode === "cancel" ? <CalendarX2 aria-hidden className="size-5" /> : <CalendarClock aria-hidden className="size-5" />}
        {pending ? "Сохраняем…" : mode === "cancel" ? "Отменить пару и уведомить группу" : "Перенести и уведомить группу"}
      </button>
    </form>
  );
}
