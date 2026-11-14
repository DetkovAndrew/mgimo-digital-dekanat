"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Обновить серверные данные страницы, когда наступит ближайший из сроков (смена пароля снова доступна, новый код дня)
 * и когда студент возвращается во вкладку. Без собственного состояния: данные приходят с сервера заново.
 */
export function RefreshAt({ at }: { at: (string | null)[] }) {
  const router = useRouter();
  const key = at.join("|");
  useEffect(() => {
    const now = Date.now();
    // Свой таймер на каждый срок: после первого обновления остальные сроки не теряются (ревью Codex 49).
    // setTimeout не ждёт дольше ~24 дней; здесь сроки в пределах суток.
    const timers = key
      .split("|")
      .filter(Boolean)
      .map((s) => new Date(s).getTime())
      .filter((t) => t > now)
      .map((t) => window.setTimeout(() => router.refresh(), Math.min(t - now + 1000, 2 ** 31 - 1)));
    const onShow = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [key, router]);
  return null;
}
