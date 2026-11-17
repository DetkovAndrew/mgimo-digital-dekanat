"use client";

import { DoorOpen, Search, X } from "lucide-react";
import { useDeferredValue, useState, type ReactNode } from "react";
import { Empty, IconTile, List, RowLink, Section } from "@/components/ui";
import { roomOnMapHref, searchRooms, type RoomIndexItem } from "@/lib/campus/search";

/** Поиск аудитории по номеру или названию; без запроса — список корпусов (children). */
export function RoomSearch({ index, children }: { index: RoomIndexItem[]; children: ReactNode }) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query).trim();
  const found = q ? searchRooms(index, q) : [];

  return (
    <>
      <div className="relative mb-6">
        <label htmlFor="room-search" className="sr-only">
          Найти аудиторию
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-3" />
        <input
          id="room-search"
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Например, 1117 или атриум"
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
            {found.length ? `Нашлось аудиторий: ${found.length}` : "Ничего не нашлось"}
          </p>
          {found.length ? (
            <List>
              {found.map((r) => (
                <RowLink key={`${r.buildingId}-${r.number}`} href={roomOnMapHref(r)}>
                  <span className="flex items-center gap-3">
                    <IconTile icon={DoorOpen} tone={r.bookable ? "ok" : "neutral"} />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {r.number} · {r.title ?? r.kind}
                      </span>
                      <span className="block text-sm text-ink-2">
                        {r.building}, {r.floor} этаж{r.bookable ? " · можно забронировать" : ""}
                      </span>
                    </span>
                  </span>
                </RowLink>
              ))}
            </List>
          ) : (
            <Empty>Такой аудитории нет на схемах. Проверьте номер: первая цифра — крыло, вторая — этаж.</Empty>
          )}
        </Section>
      ) : (
        children
      )}
    </>
  );
}
