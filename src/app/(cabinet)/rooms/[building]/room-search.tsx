"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { roomOnMapHref, searchRooms, type RoomIndexItem } from "@/lib/campus/search";

/**
 * Поиск аудитории в этом корпусе: по номеру или названию. Схема остаётся на месте, найденные — списком под строкой;
 * Enter открывает первую. Выбор — та же страница с ?room=: схема переходит на нужный этаж и выделяет аудиторию.
 */
export function BuildingRoomSearch({ index, building }: { index: RoomIndexItem[]; building: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query).trim();
  const found = q ? searchRooms(index, q, 8) : [];
  const go = (r: RoomIndexItem) => {
    setQuery("");
    router.push(roomOnMapHref(r), { scroll: false });
  };

  return (
    <form
      role="search"
      aria-label={`Аудитории: ${building}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (found[0]) go(found[0]);
      }}
      className="relative mb-4"
    >
      <label htmlFor="building-room-search" className="sr-only">
        Найти аудиторию в этом корпусе
      </label>
      <Search aria-hidden className="pointer-events-none absolute top-6 left-3.5 size-5 -translate-y-1/2 text-ink-3" />
      <input
        id="building-room-search"
        type="search"
        inputMode="search"
        enterKeyHint="go"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Номер аудитории в этом корпусе"
        autoComplete="off"
        className="min-h-12 w-full rounded-xl border border-field bg-surface py-2.5 pr-12 pl-11 text-body outline-none [&::-webkit-search-cancel-button]:hidden focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {query && (
        <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск" className="absolute top-0.5 right-1 grid size-11 place-items-center rounded-xl text-ink-3 hover:bg-fill">
          <X aria-hidden className="size-5" />
        </button>
      )}
      <p role="status" className="sr-only">
        {q ? (found.length ? `Нашлось аудиторий: ${found.length}` : "Ничего не нашлось") : ""}
      </p>
      {q && (
        <ul className="mt-2 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
          {found.length ? (
            found.map((r) => (
              <li key={r.number}>
                <Link
                  href={roomOnMapHref(r)}
                  scroll={false}
                  onClick={() => setQuery("")}
                  className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 transition-colors active:bg-fill md:hover:bg-fill/70"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{r.number}</span>
                    <span className="text-ink-2"> · {r.title ?? r.kind}</span>
                  </span>
                  <span className="shrink-0 text-sm text-ink-2">{r.floor} этаж</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-ink-2">В этом корпусе такой аудитории нет. Первая цифра номера — крыло, вторая — этаж.</li>
          )}
        </ul>
      )}
    </form>
  );
}
