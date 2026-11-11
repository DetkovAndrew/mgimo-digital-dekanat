"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ViewTransition } from "react";

/**
 * Переход между страницами. Ключ — адрес: новый ключ монтирует страницу заново, и срабатывают enter/exit
 * (в т. ч. /lessons/A → /lessons/B, где template не перемонтируется — ревью Codex 12).
 * Из параметров в ключ входит только `type` (вид заявки — отдельный экран); `?day=` и `?week=`
 * анимируются внутри своих страниц мягкой сменой, без сдвига всей страницы.
 * Направление задают ссылки через transitionTypes: nav-forward (вглубь), nav-back (назад), nav-tab (вкладки).
 */
export function RouteMotion({ children }: { children: React.ReactNode }) {
  const key = `${usePathname()}?${useSearchParams().get("type") ?? ""}`;
  return (
    <ViewTransition
      key={key}
      enter={{ "nav-forward": "slide-in-right", "nav-back": "slide-in-left", "nav-tab": "fade-in", default: "fade-in" }}
      exit={{ "nav-forward": "slide-out-left", "nav-back": "slide-out-right", "nav-tab": "fade-out", default: "none" }}
      default="none"
    >
      <div>{children}</div>
    </ViewTransition>
  );
}
