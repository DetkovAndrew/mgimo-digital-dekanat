"use client";

import "./globals.css";
import { Disclaimer } from "@/components/disclaimer";
import { type ErrorBoundaryProps, ErrorState } from "@/components/error-state";

// Сбой в корневом макете: он заменяется целиком, поэтому свои <html> и <body>. Скрипта темы здесь нет, тема светлая.
export default function GlobalError(props: ErrorBoundaryProps) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-page font-sans text-ink antialiased">
        <title>Сбой · Деканат University</title>
        <div className="flex min-h-dvh flex-col">
          <Disclaimer />
          <main className="flex flex-1 items-center justify-center px-4">
            <ErrorState {...props} title="Страница не загрузилась" home={{ href: "/", label: "На главную" }} />
          </main>
        </div>
      </body>
    </html>
  );
}
