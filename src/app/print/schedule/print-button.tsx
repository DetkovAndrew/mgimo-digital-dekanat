"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-fill px-4 font-semibold text-on-brand print:hidden">
      <Printer aria-hidden className="size-5" />
      Печать или PDF
    </button>
  );
}
