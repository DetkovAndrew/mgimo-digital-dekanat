import Link from "next/link";
import type { ReactNode } from "react";
import { Disclaimer } from "@/components/disclaimer";
import { SignOut } from "@/components/nav";
import { requireStaff } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requireStaff();
  return (
    <div className="min-h-dvh bg-page text-ink">
      <Disclaimer />
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/staff" className="flex min-h-11 min-w-0 items-center text-lead font-semibold">University · Деканат</Link>
          <SignOut className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-body text-ink-2 hover:bg-fill" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 md:py-10">{children}</main>
    </div>
  );
}
