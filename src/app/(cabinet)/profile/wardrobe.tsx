"use client";

import { Lock } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { MascotIcon } from "@/components/mascots";
import { toast } from "@/components/toast";
import { SKINS, type SkinId } from "@/lib/invictia/skins";
import { setSkinAction } from "./actions";

/** Гардероб Инвиктии: образ сразу появляется на кнопке помощника и на маршруте. Закрытые — с подсказкой, как открыть. */
export function Wardrobe({ current, unlocked }: { current: SkinId; unlocked: SkinId[] }) {
  const [shown, setShown] = useOptimistic(current);
  const [, start] = useTransition();
  const choose = (id: SkinId) =>
    start(async () => {
      setShown(id);
      const r = await setSkinAction(id);
      toast(r.ok, r.ok ? `Образ «${SKINS.find((s) => s.id === id)!.name}» надет` : r.error);
    });

  return (
    <fieldset>
      <legend className="sr-only">Образ Инвиктии</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SKINS.map((s) => {
          const open = unlocked.includes(s.id);
          return (
            <label
              key={s.id}
              className={`flex min-h-36 flex-col items-center gap-1 rounded-2xl bg-surface p-3 text-center ring-1 ring-hairline transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                open ? "cursor-pointer hover:bg-fill/60 has-[:checked]:bg-brand-soft has-[:checked]:ring-2 has-[:checked]:ring-brand" : "cursor-not-allowed"
              }`}
            >
              <input type="radio" name="skin" value={s.id} checked={shown === s.id} disabled={!open} onChange={() => choose(s.id)} className="sr-only" />
              <span className={`relative ${open ? "" : "opacity-45 grayscale"}`}>
                <MascotIcon skin={s} size={64} />
                {!open && (
                  <span aria-hidden className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-hairline">
                    <Lock className="size-3.5" />
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="text-xs text-ink-2">{open ? s.about : `Откроется: ${s.hint}`}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
