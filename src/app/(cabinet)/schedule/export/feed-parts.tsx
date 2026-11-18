"use client";

import { Eye, EyeOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "@/components/toast";
import { CopyButton } from "../../services/wifi/wifi-parts";
import { rotateFeedAction } from "./actions";

/** Адрес подписки скрыт, пока студент сам не откроет: по нему любой видит расписание (как пароль). */
export function FeedAddress({ url }: { url: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-xl bg-fill px-3">
      <span className="relative min-w-0 flex-1 truncate py-2 font-mono text-sm" aria-live="polite">
        {shown ? url : url.replace(/feed\/.+$/, "feed/••••••••••••")}
        {!shown && <span className="sr-only">Адрес скрыт</span>}
      </span>
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? "Скрыть адрес" : "Показать адрес"}
        onClick={() => setShown((v) => !v)}
        className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface"
      >
        {shown ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
      </button>
      <CopyButton value={url} label="Адрес подписки" />
    </div>
  );
}

/** Новая ссылка: два шага — подписанные календари перестанут обновляться. */
export function RotateFeedButton() {
  const [confirm, setConfirm] = useState(false);
  const [pending, run] = useTransition();
  if (!confirm)
    return (
      <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand ring-1 ring-hairline transition-colors hover:bg-fill">
        <RefreshCw aria-hidden className="size-4" />
        Выпустить новую ссылку
      </button>
    );
  return (
    <div role="group" aria-label="Подтвердите новую ссылку" className="rounded-xl bg-warn-soft p-3 text-sm">
      <p className="mb-2 text-ink">Календари, подписанные по старой ссылке, перестанут обновляться. Уже скачанные события в них останутся, удалите подписку вручную.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await rotateFeedAction();
              toast(r.ok, r.message);
              setConfirm(false);
            })
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-fill px-4 font-semibold text-on-brand disabled:opacity-60"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
          Выпустить
        </button>
        <button type="button" onClick={() => setConfirm(false)} className="inline-flex min-h-11 items-center rounded-xl px-4 font-medium text-ink-2 hover:bg-fill">
          Не надо
        </button>
      </div>
    </div>
  );
}
