import { SearchX } from "lucide-react";
import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";

// Сюда же попадает чужая заявка, бронь или заметка: 404 не подтверждает, что такой объект существует.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-page text-ink">
      <Disclaimer />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <span aria-hidden className="mb-5 grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
          <SearchX className="size-7" />
        </span>
        <h1 className="mb-2 text-title font-semibold">Страница не найдена</h1>
        <p className="mb-6 text-body text-ink-2">Адрес неверный, или у вас нет доступа к этим данным.</p>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-brand-fill px-5 text-body font-semibold text-on-brand">
          На главную
        </Link>
      </main>
    </div>
  );
}
