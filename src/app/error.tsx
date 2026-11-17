"use client";

import { Disclaimer } from "@/components/disclaimer";
import { type ErrorBoundaryProps, ErrorState } from "@/components/error-state";

// Сбой выше разделов: в макете кабинета (сессия, счётчик уведомлений), на входе, на проверке справки.
// Страница целиком своя, поэтому с обязательной оговоркой.
export default function RootError(props: ErrorBoundaryProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-page text-ink">
      <Disclaimer />
      <main className="flex flex-1 items-center justify-center px-4">
        <ErrorState {...props} title="Страница не загрузилась" home={{ href: "/", label: "На главную" }} />
      </main>
    </div>
  );
}
