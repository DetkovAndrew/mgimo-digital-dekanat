import { ChevronRight, DoorOpen, MapPinned, Search } from "lucide-react";
import Link from "next/link";
import { ROOM_KIND_STYLE } from "@/components/campus-map";
import { Disclosure, IconTile, List, PageTitle, RowLink, Section } from "@/components/ui";
import { roomKindLabel } from "@/lib/campus/plans";
import { ROOM_RULES } from "@/lib/campus/rules";
import { formatDay, formatTime, mskDayKey } from "@/lib/format";
import { listMyRoomBookings } from "@/server/dal/rooms";
import { CancelRoomBooking } from "./booking";

export default async function RoomsPage() {
  const mine = await listMyRoomBookings();

  return (
    <>
      <PageTitle sub="Коворкинги, переговорные и свободные аудитории: выберите время и забронируйте">Бронирование аудиторий</PageTitle>

      {/* Быстрая бронь: когда и на сколько → свободные → забронировать (без поиска по схеме). */}
      <Link
        href="/rooms/find"
        transitionTypes={["nav-forward"]}
        className="mb-6 flex min-h-14 items-center gap-3 rounded-2xl bg-brand-fill px-4 text-on-brand transition active:scale-[0.99]"
      >
        <Search aria-hidden className="size-5 shrink-0" />
        <span className="flex-1">
          <span className="block font-semibold">Найти свободную аудиторию</span>
          <span className="block text-sm text-on-brand">Выберите время, забронируйте в два касания</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0" />
      </Link>

      {mine.length > 0 && (
        <Section title="Мои брони">
          <List>
            {mine.map((b) => {
              const s = ROOM_KIND_STYLE[b.room.kind];
              const room = new URLSearchParams({ room: b.room.number, d: mskDayKey(b.startsAt) });
              return (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl ${s.soft} text-ink`}>
                    <DoorOpen className="size-5" />
                  </span>
                  <Link href={`/rooms/${b.room.buildingId}?${room}#room`} transitionTypes={["nav-forward"]} className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {b.room.number} · {b.room.title ?? roomKindLabel[b.room.kind]}
                    </span>
                    <span className="block text-sm text-ink-2 first-letter:uppercase">
                      {formatDay(b.startsAt)}, {formatTime(b.startsAt)} до {formatTime(b.endsAt)} · {b.room.building.title}
                    </span>
                    <span className="block truncate text-xs text-ink-2">{b.purpose}</span>
                  </Link>
                  <CancelRoomBooking id={b.id} />
                </li>
              );
            })}
          </List>
        </Section>
      )}

      {/* Конкретную аудиторию удобнее выбрать на схеме: там её расписание на день и форма брони. */}
      <Section title="Знаете, какую аудиторию хотите?">
        <List>
          <RowLink href="/map">
            <span className="flex items-center gap-3">
              <IconTile icon={MapPinned} tone="neutral" />
              <span className="min-w-0">
                <span className="block font-medium">Найти на карте</span>
                <span className="block text-sm text-ink-2">По номеру или названию: её расписание и бронь на схеме корпуса</span>
              </span>
            </span>
          </RowLink>
        </List>
      </Section>

      <Disclosure title="Правила брони">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>
            Бронируются коворкинги, переговорные и отмеченные аудитории, с {ROOM_RULES.opens} до {ROOM_RULES.closes}.
          </li>
          <li>От 30 минут до 3 часов, шаг 30 минут, на {ROOM_RULES.windowDays} дней вперёд.</li>
          <li>
            Не больше {ROOM_RULES.maxActive} активных броней и одной в день. Коворкинг бронируется целиком.
          </li>
          <li>Другие студенты видят только, что время занято, без имени и цели. Правила демонстрационные.</li>
        </ul>
      </Disclosure>
    </>
  );
}
