"use client";

import { Bell as BellIcon, CalendarDays, CircleUserRound, DoorOpen, Dumbbell, FileText, GraduationCap, House, LayoutGrid, LoaderCircle, LogOut, type LucideIcon, MapPinned, QrCode } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, ViewTransition } from "react";
import { pushReleaseAction } from "@/app/push-actions";
import { authClient } from "@/lib/auth-client";
import { currentPushSubscription } from "@/lib/push-client";
import { UniversityMark } from "./university-mark";

// Нижнее меню телефона, 6 разделов: ядро ТЗ, спорт (решение капитана 14.11: своя вкладка, даже если меню
// придётся листать) и «Сервисы» (карта, бронирование аудиторий, пропуск, Wi-Fi, печать). Уведомления и профиль в шапке.
const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/today", label: "Сегодня", icon: House },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/grades", label: "Учёба", icon: GraduationCap },
  { href: "/sport", label: "Спорт", icon: Dumbbell },
  { href: "/requests", label: "Заявки", icon: FileText },
  { href: "/services", label: "Сервисы", icon: LayoutGrid },
];

const desktopItems = [
  ...items,
  { href: "/map", label: "Карта", icon: MapPinned },
  { href: "/rooms", label: "Бронирование аудиторий", icon: DoorOpen },
  { href: "/pass", label: "Пропуск", icon: QrCode },
  { href: "/notifications", label: "Уведомления", icon: BellIcon },
  { href: "/profile", label: "Профиль", icon: CircleUserRound },
];

// Разделы, открытые изнутри вкладки (пара, дисциплина…), подсвечивают свою вкладку.
const owner: Record<string, string> = {
  lessons: "/schedule",
  teachers: "/schedule",
  buildings: "/schedule",
  courses: "/grades",
  rooms: "/services",
  map: "/services",
  pass: "/services",
};

/**
 * Колокольчик работает как переключатель: на открытых уведомлениях повторное нажатие закрывает их и
 * возвращает на экран, с которого их открыли колокольчиком, иначе на «Сегодня». Длину истории не проверяем:
 * уведомления могли открыть ссылкой с другого сайта, и «назад» увёл бы туда (ревью Codex 60).
 */
let openedByBell = false; // общий для колокольчика в шапке телефона и пункта меню на компьютере

function useCloseNotifications() {
  const pathname = usePathname();
  const router = useRouter();
  const open = pathname === "/notifications";
  useEffect(() => {
    if (pathname !== "/notifications") openedByBell = false;
  }, [pathname]);
  return (e: React.MouseEvent) => {
    if (!open) {
      openedByBell = true; // ссылка сейчас добавит /notifications поверх текущего экрана кабинета
      return;
    }
    e.preventDefault();
    if (openedByBell) router.back();
    else router.replace("/today");
  };
}

export function Nav({ unread, avatar }: { unread: number; avatar: string | null }) {
  const pathname = usePathname();
  const section = owner[pathname.split("/")[1]] ?? pathname;
  const active = (href: string) => section === href || section.startsWith(`${href}/`);
  // На десктопе у карты, брони и пропуска свои пункты меню, на телефоне они открываются из «Сервисов».
  // Схема корпуса (/rooms/kronv) относится к «Карте», а поиск свободной (/rooms/find) к «Бронированию».
  const own = (href: string) =>
    /^\/rooms\/(?!find)/.test(pathname) ? href === "/map" : pathname === href || pathname.startsWith(`${href}/`);
  const ownItem = desktopItems.find((i) => own(i.href));
  const deskActive = (href: string) => (ownItem ? ownItem.href === href : active(href));
  const closeNotifications = useCloseNotifications();

  return (
    <>
      {/* Телефон: нижняя панель */}
      <nav
        style={{ viewTransitionName: "app-nav" }}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        {/* Шесть вкладок: от 360 px помещаются целиком, на более узких экранах меню листается вбок. */}
        <ul className="mx-auto flex max-w-lg overflow-x-auto px-1 [scrollbar-width:none]">
          {items.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <li key={href} className="min-w-12 shrink-0 grow basis-auto">
                <Link
                  href={href}
                  transitionTypes={["nav-tab"]}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-micro whitespace-nowrap transition-colors ${
                    on ? "font-semibold text-brand" : "text-ink-2"
                  }`}
                >
                  {on && (
                    <ViewTransition name="tab-pill" share="auto">
                      <span aria-hidden className="absolute top-1.5 h-7 w-12 rounded-full bg-brand-soft" />
                    </ViewTransition>
                  )}
                  <TabPending />
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
            const on = deskActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  transitionTypes={["nav-tab"]}
                  onClick={href === "/notifications" ? closeNotifications : undefined}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    on ? "bg-brand-soft font-semibold text-brand" : "text-ink-2 hover:bg-fill"
                  }`}
                >
                  {href === "/profile" && avatar ? <AvatarImg src={avatar} className="size-4.5" /> : <Icon aria-hidden className="size-4.5" />}
                  <span className="flex-1">{label}</span>
                  {href === "/notifications" && unread > 0 && (
                    <span className="rounded-full bg-bad-fill px-1.5 text-xs leading-5 text-on-brand">{unread}</span>
                  )}
                  <RowPending />
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

// Разделы динамические и без loading.tsx: пока сервер готовит страницу, история не меняется и касание на медленной
// сети кажется потерянным. Нажатый пункт отвечает сразу. Элементы есть всегда и меняют только прозрачность: без сдвига.

/** Вкладка телефона: под иконкой сразу проявляется пилюля, как у выбранной, и мягко пульсирует до перехода. */
function TabPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`absolute top-1.5 h-7 w-12 rounded-full bg-brand-soft transition-opacity duration-150 motion-reduce:transition-none ${
        pending ? "opacity-100 motion-safe:animate-pulse" : "opacity-0"
      }`}
    />
  );
}

/** Пункт боковой панели: крутящийся значок справа, пока раздел загружается. */
function RowPending() {
  const { pending } = useLinkStatus();
  return (
    <LoaderCircle
      aria-hidden
      className={`size-4 shrink-0 text-brand transition-opacity duration-150 motion-reduce:transition-none ${pending ? "opacity-100 motion-safe:animate-spin" : "opacity-0"}`}
    />
  );
}

/** Собственный знак University: буква U на «фундаменте», без символики реальных вузов. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <UniversityMark size={size} />
  );
}

export function SignOut({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={async () => {
        // Устройство перестаёт получать уведомления этого входа (docs/plans/push.md). Сбой не мешает выйти.
        const sub = await currentPushSubscription().catch(() => null);
        if (sub) {
          await pushReleaseAction(sub.endpoint).catch(() => undefined);
          await sub.unsubscribe().catch(() => undefined);
        }
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

/** Пропуск (QR) из шапки телефона: проходка всегда в одно касание. */
export function PassLink() {
  return (
    <Link href="/pass" transitionTypes={["nav-forward"]} aria-label="Пропуск, QR-код" className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-fill">
      <QrCode aria-hidden className="size-5.5" />
    </Link>
  );
}

/** Колокольчик уведомлений для шапки на телефоне. */
export function Bell({ unread }: { unread: number }) {
  const close = useCloseNotifications();
  const open = usePathname() === "/notifications";
  return (
    <Link
      href="/notifications"
      transitionTypes={["nav-tab"]}
      onClick={close}
      aria-label={open ? "Закрыть уведомления" : unread ? `Уведомления: ${unread} новых` : "Уведомления"}
      className={`relative grid size-11 place-items-center rounded-full transition-colors hover:bg-fill ${open ? "bg-brand-soft text-brand" : "text-ink-2"}`}
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

/** Своё фото из /api/avatar (только владельцу, без кеша). next/image не подходит: оптимизатор ходит без cookie. */
export function AvatarImg({ src, className = "" }: { src: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden className={`shrink-0 rounded-full bg-fill object-cover ${className}`} />;
}

export function ProfileLink({ avatar }: { avatar: string | null }) {
  return (
    <Link
      href="/profile"
      transitionTypes={["nav-tab"]}
      aria-label="Профиль"
      className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-fill"
    >
      {avatar ? <AvatarImg src={avatar} className="size-7 ring-1 ring-hairline" /> : <CircleUserRound aria-hidden className="size-5.5" />}
    </Link>
  );
}
