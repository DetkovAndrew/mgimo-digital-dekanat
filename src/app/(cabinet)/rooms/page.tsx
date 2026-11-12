import { Building2, ChevronRight, DoorOpen } from "lucide-react";
import Link from "next/link";
import { ROOM_KIND_STYLE } from "@/components/campus-map";
import { Disclosure, List, PageTitle, Section } from "@/components/ui";
import { roomKindLabel } from "@/lib/campus/plans";
import { ROOM_RULES } from "@/lib/campus/rules";
import { formatDay, formatTime, mskDayKey } from "@/lib/format";
import { listCampus, listMyRoomBookings } from "@/server/dal/rooms";
import { CancelRoomBooking } from "./booking";

export default async function RoomsPage() {
  const [campus, mine] = await Promise.all([listCampus(), listMyRoomBookings()]);

  return (
    <>
      <PageTitle sub="Коворкинги и переговорные: схема корпуса, расписание аудитории и бронь">Аудитории</PageTitle>

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

      <Section title="Выберите корпус">
        <ul className="grid gap-3 sm:grid-cols-2">
          {campus.map((c) => (
            <li key={c.id}>
              <Link
                href={`/rooms/${c.id}`}
                transitionTypes={["nav-forward"]}
                className="group flex h-full flex-col rounded-3xl bg-surface p-4 ring-1 ring-hairline transition hover:bg-fill/50 active:scale-[0.99]"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand-fill text-lead font-bold text-on-brand">{c.short}</span>
                  <ChevronRight aria-hidden className="size-5 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-3 block text-lead font-semibold">{c.name}</span>
                <span className="block text-sm text-ink-2">
                  {c.address}
                  {c.metro && ` · м. ${c.metro}`}
                </span>
                <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
                  <span className="flex items-center gap-1">
                    <Building2 aria-hidden className="size-3.5" />
                    {c.wings > 1 ? `${c.wings} крыла · ` : ""}
                    {c.floors.length} этажа
                  </span>
                  <span className="flex items-center gap-1">
                    <DoorOpen aria-hidden className="size-3.5" />
                    можно забронировать: {c.bookable}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
