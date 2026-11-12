"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "@/components/toast";
import { ROOM_RULES } from "@/lib/campus/rules";
import { bookRoomAction, cancelRoomBookingAction } from "./actions";

const chip = "inline-flex min-h-11 min-w-16 items-center justify-center rounded-xl px-3 text-sm font-medium tabular-nums ring-1 transition active:scale-95";
const on = "bg-brand-fill text-on-brand ring-brand-fill";
const off = "bg-surface text-ink ring-hairline hover:bg-fill/70";

const dur = (m: number) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`);

/** Бронь в три шага на одном экране: начало → длительность → цель. Свободные начала посчитал сервер. */
export function BookForm({ roomId, day, free }: { roomId: string; day: string; free: { start: string; max: number }[] }) {
  const [start, setStart] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [purpose, setPurpose] = useState("");
  const [pending, run] = useTransition();
  const max = free.find((f) => f.start === start)?.max ?? 0;
  const lengths = Array.from({ length: ROOM_RULES.maxMinutes / ROOM_RULES.stepMin }, (_, i) => (i + 1) * ROOM_RULES.stepMin).filter((m) => m <= max);

  if (!free.length) return <p className="text-sm text-ink-2">На этот день свободного времени нет. Выберите другой день.</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!start) return;
        run(async () => {
          const r = await bookRoomAction({ roomId, day, start, minutes: Math.min(minutes, max), purpose });
          toast(r.ok, r.ok ? r.message : r.error);
          if (r.ok) {
            setStart(null);
            setPurpose("");
          }
        });
      }}
      className="space-y-4"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Начало</legend>
        <div className="flex flex-wrap gap-2">
          {free.map((f) => (
            <button key={f.start} type="button" aria-pressed={start === f.start} onClick={() => setStart(f.start)} className={`${chip} ${start === f.start ? on : off}`}>
              {f.start}
            </button>
          ))}
        </div>
      </fieldset>
      {start && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Сколько</legend>
          <div className="flex flex-wrap gap-2">
            {lengths.map((m) => (
              <button key={m} type="button" aria-pressed={Math.min(minutes, max) === m} onClick={() => setMinutes(m)} className={`${chip} ${Math.min(minutes, max) === m ? on : off}`}>
                {dur(m)}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {start && (
        <div>
          <label htmlFor="purpose" className="mb-2 block text-sm font-medium">
            Для чего
          </label>
          <input
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={ROOM_RULES.purposeMax}
            placeholder="Например: подготовка к экзамену"
            className="min-h-11 w-full rounded-xl bg-surface px-3 text-body ring-1 ring-field placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-focus"
          />
          <p className="mt-1 text-xs text-ink-2">Остальные увидят только, что время занято.</p>
        </div>
      )}
      <button
        type="submit"
        disabled={!start || pending || purpose.trim().length < 2}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-fill font-semibold text-on-brand transition active:scale-[0.98] disabled:bg-fill disabled:text-ink-3"
      >
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {start ? `Забронировать ${start}, ${dur(Math.min(minutes, max))}` : "Выберите время"}
      </button>
    </form>
  );
}

export function CancelRoomBooking({ id }: { id: string }) {
  const [pending, run] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Отменить бронь?")) return;
        run(async () => {
          const r = await cancelRoomBookingAction(id);
          toast(r.ok, r.ok ? r.message : r.error);
        });
      }}
      className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-bad transition hover:bg-bad-soft active:scale-95 disabled:opacity-50"
    >
      {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : "Отменить"}
    </button>
  );
}
