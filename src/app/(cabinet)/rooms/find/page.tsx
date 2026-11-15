import { Users } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ROOM_KIND_STYLE } from "@/components/campus-map";
import { Empty, PageTitle, Section } from "@/components/ui";
import { endOf, FIND_CAPACITIES, FIND_DURATIONS, findHref, findStarts, parseFind, toHHMM, type FindQuery } from "@/lib/campus/find";
import { PLANS, roomKindLabel, type RoomKind } from "@/lib/campus/plans";
import { ROOM_RULES, roomDayKeys } from "@/lib/campus/rules";
import { findFreeRooms } from "@/server/dal/rooms";
import { QuickBook } from "./quick-book";
import { FilterMenu } from "./filter-menu";

// «Найти свободную»: как в боте, которым студенты бронировали аудитории: выбрал когда и на сколько, получил
// список свободных и забронировал прямо из него. Все параметры здесь ссылки, каждый тап сразу даёт результат.

const weekday = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "short" });
const dayNum = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short" });
const noon = (key: string) => new Date(`${key}T12:00:00+03:00`);
const dur = (m: number) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)},5 ч` : `${m / 60} ч`);
const nowMin = () => {
  const p = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  return Number(p.find((x) => x.type === "hour")!.value) * 60 + Number(p.find((x) => x.type === "minute")!.value);
};

export default async function FindRoomPage({ searchParams }: PageProps<"/rooms/find">) {
  const q = parseFind(await searchParams);
  const end = endOf(q);
  const today = roomDayKeys()[0];
  const at = (p: Partial<FindQuery>) => findHref({ ...q, ...p });

  // Свободна весь интервал: обрезаем свободные окна по [начало, конец] и требуем полную длительность.
  const found = await findFreeRooms({ day: q.d, after: q.t, before: end, minMinutes: q.m, ...(q.b ? { building: q.b } : {}) });
  const rooms = "error" in found ? [] : found.rooms.filter((r) => r.capacity >= q.c).sort((a, b) => a.capacity - b.capacity);
  // Если на это время пусто, подскажем, когда в этот день свободно (те же корпус и вместимость).
  const later = rooms.length || "error" in found ? null : await findFreeRooms({ day: q.d, minMinutes: q.m, ...(q.b ? { building: q.b } : {}) });
  const hints = later && !("error" in later) ? later.rooms.filter((r) => r.capacity >= q.c).slice(0, 5) : [];

  const starts = findStarts(q.m).filter((t) => q.d !== today || Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) > nowMin());

  return (
    <>
      <BackLink href="/rooms">Бронирование</BackLink>
      <PageTitle sub={`Коворкинги, переговорные и аудитории, которые студенты могут бронировать. С ${ROOM_RULES.opens} до ${ROOM_RULES.closes}, до ${ROOM_RULES.windowDays} дней вперёд.`}>
        Найти свободную
      </PageTitle>

      {/* Параметры поиска — на своей подложке, каждый свёрнут в меню: видно, что выбрано, без пяти рядов кнопок. */}
      <section aria-label="Параметры поиска" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-brand-soft p-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 sm:col-span-1">
          <FilterMenu label="День" items={roomDayKeys().map((d, i) => ({ href: at({ d }), text: i === 0 ? "Сегодня" : i === 1 ? "Завтра" : dayNum.format(noon(d)), sub: i > 1 ? weekday.format(noon(d)) : undefined, on: d === q.d }))} />
        </div>
        <FilterMenu label="Начало" items={starts.map((t) => ({ href: at({ t }), text: t, on: t === q.t }))} />
        <FilterMenu label="Сколько" align="right" items={FIND_DURATIONS.map((m) => ({ href: at({ m, t: findStarts(m).includes(q.t) ? q.t : findStarts(m).at(-1)! }), text: dur(m), on: m === q.m }))} />
        <FilterMenu label="Корпус" items={[{ href: at({ b: null }), text: "Любой", on: !q.b }, ...PLANS.map((p) => ({ href: at({ b: p.buildingId }), text: p.title, on: q.b === p.buildingId }))]} />
        <FilterMenu label="Мест не меньше" align="right" items={FIND_CAPACITIES.map((c) => ({ href: at({ c }), text: c ? String(c) : "Неважно", on: c === q.c }))} />
      </section>

      <Section title={`Свободно с ${q.t} до ${end}`}>
        {"error" in found ? (
          <Empty>{found.error}</Empty>
        ) : rooms.length ? (
          <ul className="space-y-2">
            {rooms.map((r) => (
              <li key={`${r.building}-${r.number}`} className="rounded-2xl bg-surface p-3 ring-1 ring-hairline">
                <div className="flex items-start gap-3">
                  <span aria-hidden className={`grid size-11 shrink-0 place-items-center rounded-xl text-xs font-bold tabular-nums text-ink ${ROOM_KIND_STYLE[r.kind as RoomKind]?.soft ?? ""}`}>
                    {r.number.slice(-2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`${r.link}#room`} transitionTypes={["nav-forward"]} className="font-semibold text-brand">
                      {r.number} · {r.name === r.kind ? roomKindLabel[r.kind as RoomKind] : r.name}
                    </Link>
                    <p className="flex items-center gap-1.5 text-sm text-ink-2">
                      {r.building}
                      <span aria-hidden>·</span>
                      <Users aria-hidden className="size-3.5" />
                      {r.capacity}
                    </p>
                  </div>
                </div>
                <QuickBook key={`${r.id}-${q.d}-${q.t}-${q.m}`} roomId={r.id} day={q.d} start={q.t} minutes={q.m} label={`с ${q.t} до ${end}`} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            <Empty>С {q.t} до {end} свободных нет. Выберите другое время или длительность.</Empty>
            {hints.length > 0 && (
              <ul aria-label="Когда свободно в этот день" className="mt-3 space-y-2">
                {hints.map((r) => (
                  <li key={r.link} className="rounded-2xl bg-surface p-3 text-sm ring-1 ring-hairline">
                    <p className="font-medium">
                      {r.number} · {r.building}, {r.capacity} мест
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {r.free.map((f) => {
                        const from = f.slice(0, 5);
                        return (
                          <Link key={f} href={at({ t: findStarts(q.m).includes(from) ? from : q.t, b: q.b })} replace scroll={false} className="inline-flex min-h-11 items-center rounded-xl bg-page px-3 font-medium text-brand ring-1 ring-hairline">
                            {f}
                          </Link>
                        );
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>
      <p className="mt-3 text-xs text-ink-2">
        Правила (демо): от {ROOM_RULES.minMinutes} минут до {ROOM_RULES.maxMinutes / 60} часов, не больше {ROOM_RULES.maxActive} активных броней и {ROOM_RULES.maxPerDay} в день.
        Остальные увидят только, что время занято. Сейчас {toHHMM(nowMin())}.
      </p>
    </>
  );
}
