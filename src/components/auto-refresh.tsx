"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Перерисовывает серверную страницу раз в минуту, пока вкладка видна: «через N мин» и метка «сейчас» не застывают. */
export function AutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && router.refresh();
    const id = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);
  return null;
}
