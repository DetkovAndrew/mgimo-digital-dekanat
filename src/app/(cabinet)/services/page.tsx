import { ChevronRight, DoorOpen, Dumbbell, LifeBuoy, type LucideIcon, MapPinned, MessageCircleQuestion, Printer, QrCode, Ticket, Users, Wifi } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconTile, List, PageTitle, RowLink, Section } from "@/components/ui";
import { plural, type Tone } from "@/lib/format";
import { getMyPrintBalance } from "@/server/dal/print";
import { listMyRoomBookings } from "@/server/dal/rooms";
import { getMySport } from "@/server/dal/sport";
import { getMyWifi } from "@/server/dal/wifi";

// «Сервисы» (docs/plans/services.md): кампус в телефоне. Плитки показывают живое состояние, а не только ссылку.

export const dynamic = "force-dynamic";

function Tile({ href, icon, tone, title, children }: { href: string; icon: LucideIcon; tone: Tone | "brand"; title: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      transitionTypes={["nav-forward"]}
      className="group flex min-h-32 flex-col justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-hairline transition active:scale-[0.98] md:hover:bg-fill/60"
    >
      <IconTile icon={icon} tone={tone} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-ink-2">{children}</span>
      </span>
    </Link>
  );
}

function Row({ href, icon, tone, title, sub }: { href: string; icon: LucideIcon; tone: Tone | "brand"; title: string; sub: string }) {
  return (
    <RowLink href={href}>
      <span className="flex items-center gap-3">
        <IconTile icon={icon} tone={tone} />
        <span className="min-w-0">
          <span className="block font-medium">{title}</span>
          <span className="block text-sm text-ink-2">{sub}</span>
        </span>
      </span>
    </RowLink>
  );
}

export default async function ServicesPage() {
  const [print, wifi, sport, bookings] = await Promise.all([getMyPrintBalance(), getMyWifi(), getMySport(), listMyRoomBookings()]);

  return (
    <>
      <PageTitle sub="Кампус в телефоне: пропуск, карта, бронирование, Wi-Fi, печать и помощь.">Сервисы</PageTitle>

      {/* Главное: пройти в корпус, поэтому пропуск ведёт экран. */}
      <Link
        href="/pass"
        transitionTypes={["nav-forward"]}
        className="group mb-3 flex items-center gap-4 rounded-3xl bg-brand-fill p-5 text-on-brand transition active:scale-[0.99]"
      >
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-on-brand/15">
          <QrCode className="size-8" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-title leading-tight font-bold">Пропуск</span>
          <span className="block text-sm opacity-90">QR для турникета, обновляется каждые 30 секунд</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile href="/services/wifi" icon={Wifi} tone="info" title="Wi-Fi">
          {wifi.ssid} · {wifi.login}
        </Tile>
        <Tile href="/services/print" icon={Printer} tone="brand" title="Печать">
          Осталось {print.left} из {print.limit} стр.
          {print.queued > 0 && ` · в очереди ${print.queued}`}
        </Tile>
        <Tile href="/rooms" icon={DoorOpen} tone="ok" title="Бронирование аудиторий">
          {bookings.length ? `Мои брони: ${bookings.length}. Найти свободную` : "Найти свободную и забронировать"}
        </Tile>
        <Tile href="/sport" icon={Dumbbell} tone="warn" title="Физкультура">
          {sport.progress.total} из {sport.rules.total} {plural(sport.rules.total, "балла", "баллов", "баллов")}
        </Tile>
      </div>

      <Section title="Кампус">
        <List>
          <Row href="/map" icon={MapPinned} tone="brand" title="Карта" sub="Найти аудиторию по номеру или названию, схемы корпусов и как пройти" />
          <Row href="/services/print#printers" icon={Printer} tone="neutral" title="Где принтеры" sub="Коворкинги и деканат: где стоят и что с бумагой (демо)" />
        </List>
      </Section>

      <Section title="Помощь">
        <List>
          <Row href="/services/support" icon={Users} tone="brand" title="Куда обратиться" sub="Службы университета: с чем идти, куда писать и с какой темой" />
          <Row href="/requests/new?type=it_support" icon={LifeBuoy} tone="info" title="IT-поддержка" sub="Не подключается Wi-Fi, не печатает, не входит в аккаунт" />
          <Row href="/requests/new?type=guest_pass" icon={Ticket} tone="brand" title="Гостевой пропуск" sub="Провести гостя в корпус на защиту или мероприятие" />
          <Row href="/requests/new?type=dean_question" icon={MessageCircleQuestion} tone="warn" title="Вопрос в деканат" sub="Ответ придёт в заявки и уведомления" />
        </List>
      </Section>

      <Section title="Часы работы">
        <ul className="divide-y divide-hairline rounded-2xl bg-surface text-sm ring-1 ring-hairline">
          {[
            ["Деканат", "по будням с 10 до 17", "/rooms/kronv?room=1117#room", "Кронверкский, 49, ауд. 1117"],
            ["Коворкинги", "каждый день с 8 до 21", "/rooms/kronv?room=2101#room", "«Атриум» и «Колба»"],
            ["IT-поддержка", "заявки круглосуточно", null, "ответ в рабочее время"],
          ].map(([name, hours, href, where]) => (
            <li key={name} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="block font-medium">{name}</span>
                {href ? (
                  <Link href={href} className="inline-flex min-h-11 items-center text-brand underline-offset-2 hover:underline">
                    {where}
                  </Link>
                ) : (
                  <span className="block text-ink-2">{where}</span>
                )}
              </span>
              <span className="shrink-0 text-right text-ink-2">{hours}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-xs text-ink-3">Часы работы и сервисы демонстрационные.</p>
      </Section>
    </>
  );
}
