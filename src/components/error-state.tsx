"use client";

import { CloudOff, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect } from "react";
import { themeScript } from "@/lib/theme";

export type ErrorBoundaryProps = { error: unknown; retry: () => void };

/**
 * Экран сбоя для границ ошибок (error.tsx). Текст ошибки сервера в продакшене до браузера не доходит, приходит только
 * digest: по нему ошибку находят в журнале сервера, поэтому его и показываем мелко. retry() заново запрашивает
 * раздел у сервера (reset() лишь перерисовал бы ту же ошибку).
 */
export function ErrorState({
  error,
  retry,
  title = "Раздел не загрузился",
  home = { href: "/today", label: "На «Сегодня»" },
}: ErrorBoundaryProps & { title?: string; home?: { href: string; label: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  // На ответе 500 Next присылает заготовку, а страницу рисует React в браузере: скрипт темы из <head> при этом
  // не выполняется, и экран ошибки в тёмной теме выходил светлым. Тогда подключаем тот же скрипт элементом
  // <script> (так браузер его исполняет); если он уже работает, просто применяем тему заново.
  useLayoutEffect(() => {
    if (window.__applyTheme) return window.__applyTheme();
    const script = document.createElement("script");
    script.textContent = themeScript;
    document.head.append(script);
  }, []);
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <span aria-hidden className="mb-5 grid size-14 place-items-center rounded-full bg-warn-soft text-warn">
        <CloudOff className="size-7" />
      </span>
      <h1 className="mb-2 text-title font-semibold">{title}</h1>
      <p className="mb-6 text-body text-ink-2">Сервер не смог подготовить страницу. Обычно помогает повторить через несколько секунд.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-fill px-5 text-body font-semibold text-on-brand transition hover:opacity-90"
        >
          <RotateCw aria-hidden className="size-4.5" />
          Повторить
        </button>
        <Link
          href={home.href}
          className="inline-flex min-h-11 items-center rounded-xl px-5 text-body font-semibold text-brand ring-1 ring-hairline transition-colors hover:bg-fill"
        >
          {home.label}
        </Link>
      </div>
      {digest && <p className="mt-6 text-micro text-ink-3">Код для поддержки: {digest}</p>}
    </div>
  );
}
