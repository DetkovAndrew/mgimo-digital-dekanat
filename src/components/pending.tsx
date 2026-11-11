"use client";

import { ChevronRight, LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

/** Стрелка в строке-ссылке; пока страница загружается — крутится, чтобы нажатие не казалось потерянным. */
export function Chevron() {
  const { pending } = useLinkStatus();
  return pending ? (
    <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-brand" />
  ) : (
    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink-3" />
  );
}
