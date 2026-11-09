"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const items = [
  { href: "/today", label: "Сегодня", icon: "◉" },
  { href: "/schedule", label: "Расписание", icon: "▦" },
  { href: "/grades", label: "Учёба", icon: "★" },
  { href: "/requests", label: "Заявки", icon: "✉" },
  { href: "/notifications", label: "Новости", icon: "●" },
] as const;

export function Nav({ unread }: { unread: number }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Телефон: нижняя панель */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active(i.href) ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  active(i.href) ? "font-semibold text-brand" : "text-slate-500"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">{i.icon}</span>
                {i.label}
                {i.href === "/notifications" && unread > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-18px)] min-w-4 rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white">
                    {unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Десктоп: боковая панель */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-black/5 bg-white p-4 md:flex">
        <Link href="/today" className="mb-6 flex items-center gap-2 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-brand font-bold text-white">U</span>
          <span className="font-semibold leading-tight">
            Деканат
            <br />
            <span className="text-sm font-normal text-slate-500">University</span>
          </span>
        </Link>
        <ul className="space-y-1">
          {[...items, { href: "/profile", label: "Профиль", icon: "☺" } as const].map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active(i.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                  active(i.href) ? "bg-brand/10 font-semibold text-brand" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span aria-hidden className="w-4 text-center">{i.icon}</span>
                <span className="flex-1">{i.label}</span>
                {i.href === "/notifications" && unread > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-xs leading-5 text-white">{unread}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <SignOut className="mt-auto rounded-xl px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-100" />
      </aside>
    </>
  );
}

export function SignOut({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Выйти
    </button>
  );
}
