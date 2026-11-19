"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { REQUEST_GROUPS, requestGroup } from "@/components/request-groups";
import { Empty, IconTile, List, RowLink, Section } from "@/components/ui";
import { plural } from "@/lib/format";
import type { RequestCategory } from "@/lib/requests/catalog";

/** aka — как заявку называют своими словами (src/lib/requests/guide.ts): ищется, но не показывается. */
export type PickerItem = { key: string; title: string; description: string; category: RequestCategory; slaDays: number; aka: string };

const norm = (s: string) => s.toLowerCase().replaceAll("ё", "е");

function Row({ item }: { item: PickerItem }) {
  const g = requestGroup(item.category);
  return (
    <RowLink href={`/requests/new?type=${item.key}`}>
      <span className="flex items-center gap-3">
        <IconTile icon={g.icon} tone={g.tone} />
        <span className="min-w-0">
          <span className="block font-medium">{item.title}</span>
          <span className="block text-sm text-ink-2">{item.description}</span>
          <span className="mt-0.5 block text-xs text-ink-3">Обычно {item.slaDays} {plural(item.slaDays, "рабочий день", "рабочих дня", "рабочих дней")} (демо)</span>
        </span>
      </span>
    </RowLink>
  );
}

/** Каталог заявок: разделы и поиск по названию, описанию и бытовым названиям («академ», «повышенка», «вычет»). */
export function RequestPicker({ items }: { items: PickerItem[] }) {
  const [query, setQuery] = useState("");
  const q = norm(useDeferredValue(query).trim());
  const found = q ? items.filter((i) => norm(`${i.title} ${i.description} ${i.aka}`).includes(q)) : [];

  return (
    <>
      <div className="relative mb-6">
        <label htmlFor="request-search" className="sr-only">
          Найти заявку
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-3" />
        <input
          id="request-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Например: военкомат, академ, вычет"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-field bg-surface py-2.5 pr-12 pl-11 text-body outline-none [&::-webkit-search-cancel-button]:hidden focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск" className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-ink-3 hover:bg-fill">
            <X aria-hidden className="size-5" />
          </button>
        )}
      </div>

      {q ? (
        <Section title={found.length ? `Нашлось: ${found.length}` : undefined}>
          <p role="status" className="sr-only">
            {found.length ? `Нашлось заявок: ${found.length}` : "Ничего не нашлось"}
          </p>
          {found.length ? (
            <List>
              {found.map((i) => (
                <Row key={i.key} item={i} />
              ))}
            </List>
          ) : (
            <Empty>
              Такой заявки нет.{" "}
              <Link href="/requests/new?type=dean_question" className="font-medium text-brand underline underline-offset-2">
                Задайте вопрос в деканат
              </Link>
              , ответ придёт сюда же.
            </Empty>
          )}
        </Section>
      ) : (
        REQUEST_GROUPS.map((g) => {
          const list = items.filter((i) => i.category === g.category);
          return list.length ? (
            <Section key={g.category} title={g.title}>
              <List>
                {list.map((i) => (
                  <Row key={i.key} item={i} />
                ))}
              </List>
            </Section>
          ) : null;
        })
      )}
    </>
  );
}
