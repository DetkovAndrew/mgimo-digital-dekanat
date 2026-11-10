import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { Bell, Nav } from "@/components/nav";
import { countMyUnread } from "@/server/dal/notifications";
import { requireStudent } from "@/server/session";

export default async function CabinetLayout({ children }: LayoutProps<"/">) {
  await requireStudent();
  const unread = await countMyUnread();
  return (
    <div className="flex min-h-dvh">
      <Nav unread={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Disclaimer />
        <header className="flex items-center justify-between border-b border-black/5 bg-white px-4 py-1.5 md:hidden">
          <span className="font-semibold">Деканат University</span>
          <span className="flex items-center gap-1">
            <Bell unread={unread} />
            <Link href="/profile" className="grid min-h-11 place-items-center px-2 text-sm text-brand">
              Профиль
            </Link>
          </span>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-24 md:pb-10">{children}</main>
      </div>
    </div>
  );
}
