"use client";

import { useEffect, useRef } from "react";

/** Лента чипов: выбранный (aria-current) виден сразу, даже если он далеко в ленте (например, 14:00). */
export function ScrollToCurrent({ children, className }: { children: React.ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    const on = row?.querySelector<HTMLElement>("[aria-current]");
    if (row && on) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.clientWidth / 2;
  });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
