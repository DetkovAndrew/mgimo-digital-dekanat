"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/toast";

/** «Скопировать ссылку для проверки»: ссылку студент отправляет тому, кому предоставляет справку. */
export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          toast(true, "Ссылка для проверки скопирована");
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast(false, "Не удалось скопировать. Ссылка есть на самой справке под QR-кодом.");
        }
      }}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface px-4 text-body font-semibold text-brand ring-1 ring-hairline transition-colors hover:bg-fill"
    >
      {done ? <Check aria-hidden className="size-5 text-ok" /> : <Link2 aria-hidden className="size-5" />}
      Скопировать ссылку<span className="sr-only"> для проверки справки</span>
    </button>
  );
}
