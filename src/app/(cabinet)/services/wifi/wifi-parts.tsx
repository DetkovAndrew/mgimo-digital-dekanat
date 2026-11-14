"use client";

import { Check, Copy, Eye, EyeOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "@/components/toast";
import { rotateWifiAction } from "../actions";

/** Кнопка «Скопировать»: 44 px, подтверждение галочкой и в живой области для экранного диктора. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Скопировать: ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast(true, `${label}: скопировано`);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast(false, "Не удалось скопировать. Выделите текст вручную.");
        }
      }}
      className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-fill"
    >
      {done ? <Check aria-hidden className="size-5 text-ok" /> : <Copy aria-hidden className="size-5" />}
    </button>
  );
}

/** Пароль скрыт, пока студент сам не откроет: экран телефона видят соседи по аудитории. */
export function SecretValue({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="flex min-w-0 items-center">
      <span className="min-w-0 flex-1 font-mono text-body whitespace-nowrap" aria-live="polite">
        {shown ? value : value.replace(/[^-]/g, "•")}
        {!shown && <span className="sr-only">Пароль скрыт</span>}
      </span>
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
        onClick={() => setShown((v) => !v)}
        className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-fill"
      >
        {shown ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
      </button>
      <CopyButton value={value} label="Пароль Wi-Fi" />
    </span>
  );
}

/** Смена пароля: два шага, чтобы случайное касание не отключило ноутбук от сети. */
export function RotateButton() {
  const [confirm, setConfirm] = useState(false);
  const [pending, run] = useTransition();
  if (!confirm)
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand ring-1 ring-hairline transition-colors hover:bg-fill"
      >
        <RefreshCw aria-hidden className="size-4" />
        Сменить пароль
      </button>
    );
  return (
    <div role="group" aria-label="Подтвердите смену пароля" className="rounded-xl bg-warn-soft p-3 text-sm">
      <p className="mb-2 text-ink">Все ваши устройства отключатся от University: на каждом нужно будет ввести новый пароль.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await rotateWifiAction();
              toast(r.ok, r.ok ? "Пароль Wi-Fi изменён" : r.error);
              setConfirm(false);
            })
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-fill px-4 font-semibold text-on-brand disabled:opacity-60"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
          Сменить
        </button>
        <button type="button" onClick={() => setConfirm(false)} className="inline-flex min-h-11 items-center rounded-xl px-4 font-medium text-ink-2 hover:bg-fill">
          Не надо
        </button>
      </div>
    </div>
  );
}
