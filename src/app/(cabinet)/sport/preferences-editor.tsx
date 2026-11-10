"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePreferences } from "./actions";

export type SlotView = {
  id: string;
  title: string;
  day: string; // «вторник, 17 ноября»
  time: string; // «17:00–18:30»
  place: string; // «Спорткомплекс, Игровой зал»
  coach: string;
  capacity: number;
  demand: number;
  unavailable: string | null;
};

export function PreferencesEditor({
  weekStart,
  slots,
  initial,
  max,
}: {
  weekStart: string;
  slots: SlotView[];
  initial: string[];
  max: number;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(() => initial.filter((id) => slots.some((s) => s.id === id)));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(slots.map((s) => [s.id, s]));
  const dirty = chosen.join() !== initial.join();

  const move = (i: number, d: -1 | 1) =>
    setChosen((xs) => {
      const ys = [...xs];
      [ys[i], ys[i + d]] = [ys[i + d], ys[i]];
      return ys;
    });

  const save = () =>
    startTransition(async () => {
      const r = await savePreferences(weekStart, chosen);
      setMessage(r.ok ? { ok: true, text: r.message ?? "Сохранено" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  const days = [...new Set(slots.map((s) => s.day))];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Ваши приоритеты · {chosen.length} из {max}
        </h3>
        {chosen.length ? (
          <ol className="space-y-1.5">
            {chosen.map((id, i) => {
              const s = byId.get(id);
              if (!s) return null;
              return (
                <li key={id} className="flex items-center gap-2 rounded-xl bg-brand/5 p-2 ring-1 ring-brand/20">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <b>{s.title}</b>
                    <span className="block truncate text-xs text-slate-500">
                      {s.day}, {s.time}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Выше"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="grid size-11 place-items-center rounded-lg text-slate-600 hover:bg-white disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Ниже"
                    disabled={i === chosen.length - 1}
                    onClick={() => move(i, 1)}
                    className="grid size-11 place-items-center rounded-lg text-slate-600 hover:bg-white disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Убрать"
                    onClick={() => setChosen((xs) => xs.filter((x) => x !== id))}
                    className="grid size-11 place-items-center rounded-lg text-slate-500 hover:bg-white"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            Добавьте подходящие тренировки ниже — в порядке желания. Время подачи на результат не влияет.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="min-h-11 rounded-xl bg-brand px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Сохраняем…" : "Сохранить приоритеты"}
          </button>
          {message && (
            <p role="status" className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {days.map((day) => (
          <section key={day}>
            <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{day}</h4>
            <ul className="space-y-1.5">
              {slots
                .filter((s) => s.day === day)
                .map((s) => {
                  const picked = chosen.includes(s.id);
                  const hot = s.demand > s.capacity;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ${
                        s.unavailable ? "opacity-60 ring-black/5" : "ring-black/10"
                      }`}
                    >
                      <span className="min-w-0 flex-1 text-sm">
                        <b>{s.title}</b> · {s.time}
                        <span className="block text-xs text-slate-500">
                          {s.place} · {s.coach}
                        </span>
                        <span className={`block text-xs ${hot ? "text-amber-700" : "text-slate-500"}`}>
                          Мест {s.capacity} · желающих {s.demand}
                          {hot && " — будет жеребьёвка"}
                        </span>
                        {s.unavailable && <span className="block text-xs text-red-700">Недоступно: {s.unavailable}</span>}
                      </span>
                      {!s.unavailable && (
                        <button
                          type="button"
                          disabled={picked || chosen.length >= max}
                          onClick={() => setChosen((xs) => [...xs, s.id])}
                          className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-brand ring-1 ring-brand/30 disabled:text-slate-400 disabled:ring-slate-200"
                        >
                          {picked ? "В списке" : "Добавить"}
                        </button>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
