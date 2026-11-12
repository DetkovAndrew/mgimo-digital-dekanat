"use client";

import { Bell as BellIcon, CalendarDays, CircleUserRound, Dumbbell, FileText, GraduationCap, House, LogOut, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ViewTransition } from "react";
import { authClient } from "@/lib/auth-client";

// Нижнее меню телефона — 5 главных разделов; уведомления и профиль — в шапке.
const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/today", label: "Сегодня", icon: House },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/grades", label: "Учёба", icon: GraduationCap },
  { href: "/sport", label: "Спорт", icon: Dumbbell },
  { href: "/requests", label: "Заявки", icon: FileText },
];

const desktopItems = [
  ...items,
  { href: "/notifications", label: "Уведомления", icon: BellIcon },
  { href: "/profile", label: "Профиль", icon: CircleUserRound },
];

// Разделы, открытые изнутри вкладки (пара, дисциплина…), подсвечивают свою вкладку.
const owner: Record<string, string> = { lessons: "/schedule", teachers: "/schedule", buildings: "/schedule", courses: "/grades" };

export function Nav({ unread }: { unread: number }) {
  const pathname = usePathname();
  const section = owner[pathname.split("/")[1]] ?? pathname;
  const active = (href: string) => section === href || section.startsWith(`${href}/`);

  return (
    <>
      {/* Телефон: нижняя панель */}
      <nav
        style={{ viewTransitionName: "app-nav" }}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1">
          {items.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  transitionTypes={["nav-tab"]}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-micro transition-colors ${
                    on ? "font-semibold text-brand" : "text-ink-2"
                  }`}
                >
                  {on && (
                    <ViewTransition name="tab-pill" share="auto">
                      <span aria-hidden className="absolute top-1.5 h-7 w-12 rounded-full bg-brand-soft" />
                    </ViewTransition>
                  )}
                  <Icon aria-hidden className="relative size-5.5" strokeWidth={on ? 2.3 : 1.8} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Десктоп: боковая панель */}
      <aside
        style={{ viewTransitionName: "app-nav" }}
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-hairline bg-surface p-4 md:flex"
      >
        <Link href="/today" transitionTypes={["nav-tab"]} className="mb-7 flex items-center gap-3 px-2 pt-1">
          <Logo size={40} />
          <span className="leading-tight">
            <span className="block text-lead font-bold tracking-tight">University</span>
            <span className="block text-sm text-ink-2">Цифровой деканат</span>
          </span>
        </Link>
        <ul className="space-y-0.5">
          {desktopItems.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  transitionTypes={["nav-tab"]}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    on ? "bg-brand-soft font-semibold text-brand" : "text-ink-2 hover:bg-fill"
                  }`}
                >
                  <Icon aria-hidden className="size-4.5" />
                  <span className="flex-1">{label}</span>
                  {href === "/notifications" && unread > 0 && (
                    <span className="rounded-full bg-bad-fill px-1.5 text-xs leading-5 text-on-brand">{unread}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <SignOut className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink-2 hover:bg-fill" />
      </aside>
    </>
  );
}

/** Собственный знак University: буква U на «фундаменте» — без символики реальных вузов. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 36 36" className="shrink-0">
      <rect width="36" height="36" rx="11" className="fill-brand-fill" />
      <path d="M12 9.5v8.25a6 6 0 0 0 12 0V9.5" fill="none" strokeWidth="3.4" strokeLinecap="round" className="stroke-on-brand" />
      <path d="M10.5 27h15" strokeWidth="3.4" strokeLinecap="round" className="stroke-on-brand" />
    </svg>
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
      <LogOut aria-hidden className="size-4.5" />
      Выйти
    </button>
  );
}

/** Колокольчик уведомлений для шапки на телефоне. */
export function Bell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      transitionTypes={["nav-tab"]}
      aria-label={unread ? `Уведомления: ${unread} новых` : "Уведомления"}
      className="relative grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-fill"
    >
      <BellIcon aria-hidden className="size-5.5" />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-bad-fill px-1 text-center text-micro leading-4 font-semibold text-on-brand ring-2 ring-surface">
          {unread}
        </span>
      )}
    </Link>
  );
}

export function ProfileLink() {
  return (
    <Link
      href="/profile"
      transitionTypes={["nav-tab"]}
      aria-label="Профиль"
      className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-fill"
    >
      <CircleUserRound aria-hidden className="size-5.5" />
    </Link>
  );
}
