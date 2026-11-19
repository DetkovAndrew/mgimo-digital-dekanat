import Link from "next/link";

// Раздел «Заявки» — две вкладки (капитан, 19.11): каталог «Заявки» (бывшая «Новая») и «Мои заявки» со статусами.
// Как переключатель вида на /schedule: replace, без прокрутки, переход nav-tab.
export function RequestTabs({ current, active }: { current: "catalog" | "my"; active: number }) {
  const tabs = [
    ["catalog", "Заявки", "/requests"],
    ["my", "Мои заявки", "/requests/my"],
  ] as const;
  return (
    <nav aria-label="Раздел заявок" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-hairline xl:max-w-sm">
      {tabs.map(([v, label, href]) => (
        <Link
          key={v}
          href={href}
          replace
          scroll={false}
          transitionTypes={["nav-tab"]}
          aria-current={current === v ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${current === v ? "bg-brand-fill text-on-brand" : "text-ink-2 hover:bg-fill"}`}
        >
          {label}
          {v === "my" && active > 0 && (
            <span className={`min-w-5 rounded-full px-1.5 text-xs leading-5 ${current === v ? "bg-on-brand text-brand-fill" : "bg-brand-soft text-brand"}`}>
              <span className="sr-only">в работе: </span>
              {active}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Заявки, которые ещё в работе: «Готово к выдаче» тоже здесь — документ не забран, заявка не завершена. */
export const DONE = new Set(["DONE", "REJECTED", "CANCELLED"]);
