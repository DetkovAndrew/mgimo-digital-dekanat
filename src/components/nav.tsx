"use client";

import { Bell as BellIcon, CalendarDays, CircleUserRound, Dumbbell, FileText, GraduationCap, House, LogOut, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ViewTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { UniversityMark } from "./university-mark";

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
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                    on ? "font-semibold text-brand" : "text-ink-2"
                  }`}
                >
                  {on && (
                    <ViewTransition name="tab-pill" share="auto">
                      <span aria-hidden className="absolute top-1.5 h-7 w-12 rounded-full bg-brand-soft" />
                    </ViewTransition>
                  )}
                  <Icon aria-hidden className="relative size-[22px]" strokeWidth={on ? 2.3 : 1.8} />
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
        <Link href="/today" transitionTypes={["nav-tab"]} className="mb-6 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="leading-tight font-semibold">
            Деканат
            <br />
            <span className="text-sm font-normal text-ink-2">University</span>
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
                  <Icon aria-hidden className="size-[18px]" />
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

/** Собственный знак University — без символики реальных вузов. */
export function Logo() {
  return (
    <UniversityMark />
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
      <LogOut aria-hidden className="size-[18px]" />
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
      <BellIcon aria-hidden className="size-[22px]" />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-bad-fill px-1 text-center text-[10px] leading-4 font-semibold text-on-brand ring-2 ring-surface">
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
      <CircleUserRound aria-hidden className="size-[22px]" />
    </Link>
  );
}
