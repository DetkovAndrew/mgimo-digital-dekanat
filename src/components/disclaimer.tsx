import { Info } from "lucide-react";

/** Обязательная оговорка (AGENTS.md): видна на каждой странице, но не спорит с содержимым. */
export function Disclaimer() {
  return (
    <aside aria-label="О сервисе" className="bg-fill">
      <p className="flex items-start justify-center gap-1.5 px-4 py-1.5 text-micro leading-snug text-ink-2 md:items-center">
      <Info aria-hidden className="mt-px size-3 shrink-0 md:mt-0" />
      <span>
        Концепт для конкурса MGIMO AI Challenge 2026. Не является официальным сервисом какого-либо вуза. Все данные
        вымышлены.
        </span>
      </p>
    </aside>
  );
}
