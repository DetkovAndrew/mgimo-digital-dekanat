import type { ReactNode } from "react";
import { Disclaimer } from "@/components/disclaimer";
import { UniversityMark } from "@/components/university-mark";

/** Каркас открытой страницы проверки: без меню кабинета, с дисклеймером и пометкой о демо-документе. */
export function VerifyShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page text-ink">
      <Disclaimer />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <UniversityMark size={32} />
          <div>
            <p className="font-semibold leading-tight">University</p>
            <p className="text-micro text-ink-2">Проверка справки по QR-коду</p>
          </div>
        </div>
        {children}
        <p className="mt-6 text-sm text-ink-2">
          Документы выпускает демонстрационный кабинет конкурса. Справка не подтверждает обучение в реальном вузе и
          юридической силы не имеет.
        </p>
      </main>
    </div>
  );
}
