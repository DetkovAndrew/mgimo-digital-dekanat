"use client";

import { Moon, SunMedium, SunMoon, type LucideIcon } from "lucide-react";
import { THEME_KEY, type ThemePref } from "@/lib/theme";
import { useLocal, writeLocal } from "./local-store";

const OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Светлая", icon: SunMedium },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Как в системе", icon: SunMoon },
];

/** Выбор темы. Сохраняется в этом браузере; применяется сразу, без перезагрузки. */
export function ThemePicker() {
  const current = useLocal(THEME_KEY, "system");
  const choose = (value: ThemePref) => {
    writeLocal(THEME_KEY, value);
    window.__applyTheme?.(value);
  };
  return (
    <fieldset>
      <legend className="sr-only">Тема оформления</legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className="flex min-h-18 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-2.5 text-center text-sm text-ink-2 ring-1 ring-hairline transition-colors hover:bg-fill/60 has-[:checked]:bg-brand-soft has-[:checked]:font-semibold has-[:checked]:text-ink has-[:checked]:ring-2 has-[:checked]:ring-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
          >
            <input type="radio" name="theme" value={value} checked={current === value} onChange={() => choose(value)} className="sr-only" />
            <Icon aria-hidden className="size-5" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
