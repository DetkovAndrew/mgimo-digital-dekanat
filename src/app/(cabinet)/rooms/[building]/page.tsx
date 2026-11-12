import { ArrowUp, CalendarClock, CornerUpLeft, CornerUpRight, DoorOpen, Flag, Lock, LogIn, type LucideIcon, Route, Undo2, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { BackLink } from "@/components/back-link";
import { CampusMap, MapLegend, ROOM_KIND_STYLE, Stairs } from "@/components/campus-map";
import { KindTime } from "@/components/kind";
import { Badge, Disclosure, Empty, List, PageTitle, RowLink, Section } from "@/components/ui";
import { planFor, roomKindLabel } from "@/lib/campus/plans";
import { findRoute, type RouteEnd, type StepKind } from "@/lib/campus/route";
import { ROOM_RULES, roomDayKeys } from "@/lib/campus/rules";
import { formatDay, formatTime, lessonKindLabel } from "@/lib/format";
import { getCampusState, getRoomDay } from "@/server/dal/rooms";
import { getMyRouteStart } from "@/server/dal/schedule";
import { BookForm, CancelRoomBooking } from "../booking";

const weekday = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "short" });
const dayNum = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric" });
const noon = (key: string) => new Date(`${key}T12:00:00+03:00`);
const STEP_ICON: Record<Exclude<StepKind, "start">, LucideIcon> = {
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  back: Undo2,
  up: Stairs,
  down: Stairs,
  arrive: Flag,
};

export default async function CampusPage({ params, searchParams }: PageProps<"/rooms/[building]">) {
  const { building } = await params;
  const sp = await searchParams;
  const plan = planFor(building);
  if (!plan) notFound();

  const days = roomDayKeys();
  const day = typeof sp.d === "string" && days.includes(sp.d) ? sp.d : days[0];
  const selected = typeof sp.room === "string" ? plan.rooms.find((r) => r.number === sp.room) ?? null : null;
  const floorParam = Number(sp.floor);

  // Маршрут к выбранной аудитории: from — «entrance» или номер аудитории этого корпуса (селектор, проверяется по схеме).
  const fromParam = typeof sp.from === "string" ? sp.from : null;
  const fromEnd: RouteEnd | null =
    !selected || !fromParam
      ? null
      : fromParam === "entrance"
        ? { kind: "entrance" }
        : plan.rooms.some((r) => r.number === fromParam && r.number !== selected.number)
          ? { kind: "room", number: fromParam }
          : null;
  const route = selected && fromEnd ? findRoute(building, fromEnd, { kind: "room", number: selected.number }) : null;
  // С маршрутом этаж показа отдельный от этажа аудитории: вкладки и шаги переключают его, не теряя маршрут.
  const floor = route ? (plan.floors.includes(floorParam) ? floorParam : route.startFloor) : (selected?.floor ?? (plan.floors.includes(floorParam) ? floorParam : plan.floors[0]));

  const [state, roomDay, lastRoom] = await Promise.all([
    getCampusState(building, day),
    selected ? getRoomDay(selected.id, day) : null,
    selected ? getMyRouteStart(building, new Date()) : null,
  ]);
  const url = (p: { floor?: number | null; room?: string | null; d?: string; from?: string | null }) => {
    const q = new URLSearchParams();
    if (p.floor !== null) q.set("floor", String(p.floor ?? floor));
    const room = p.room === null ? null : (p.room ?? selected?.number);
    if (room) q.set("room", room);
    q.set("d", p.d ?? day);
    const from = p.from === undefined ? (route ? fromParam : null) : p.from;
    if (room && from) q.set("from", from);
    return `/rooms/${building}?${q}`;
  };
  // Откуда вести: от входа или из аудитории последней пары сегодня, если она была в этом корпусе.
  const starts = [
    { from: "entrance", label: "От входа", icon: LogIn },
    ...(lastRoom && lastRoom !== selected?.number ? [{ from: lastRoom, label: `От ${lastRoom}, где была пара`, icon: DoorOpen }] : []),
  ];
  // Начало, введённое вручную, тоже видно среди вариантов (и отмечено выбранным).
  if (route && fromEnd?.kind === "room" && !starts.some((st) => st.from === fromEnd.number)) starts.push({ from: fromEnd.number, label: `От ${fromEnd.number}`, icon: DoorOpen });
  // Шаги блоками по этажам в порядке прохождения: этаж может встретиться дважды (3 → 2 → 3).
  const blocks = (route?.steps ?? []).reduce<{ floor: number; steps: NonNullable<typeof route>["steps"] }[]>((out, st) => {
    if (out.at(-1)?.floor === st.floor) out.at(-1)!.steps.push(st);
    else out.push({ floor: st.floor, steps: [st] });
    return out;
  }, []);
  const here = !!selected && fromParam === selected.number; // следующая пара в той же аудитории
  const bookableHere = plan.rooms.filter((r) => r.floor === floor && r.bookable);

  return (
    // На широком экране схема слева, панель аудитории справа (как «Сегодня»).
    <div className="xl:-mx-40">
      <BackLink href="/rooms">Аудитории</BackLink>
      <PageTitle sub={`${state.building.address} · ${plan.wingCount > 1 ? `${plan.wingCount} крыла, ` : ""}${plan.floors.length} этажа`}>
        {plan.title}
      </PageTitle>

      <nav aria-label="Этаж" className="mb-3 flex gap-1.5">
        {plan.floors.map((f) => (
          <Link
            key={f}
            href={url({ floor: f, room: route ? undefined : null })}
            scroll={false}
            replace
            aria-current={f === floor ? "page" : undefined}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-semibold tabular-nums transition-colors ${
              f === floor ? "bg-brand-fill text-on-brand" : "bg-surface text-ink ring-1 ring-hairline hover:bg-fill/70"
            }`}
          >
            {f} эт.
          </Link>
        ))}
      </nav>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start xl:gap-x-8">
      <div id="plan" className="scroll-mt-20 md:scroll-mt-6">
      <CampusMap
        plan={plan}
        floor={floor}
        busyNow={state.busyNow}
        mine={state.mine}
        selected={selected?.number ?? null}
        href={(n) => `${url({ room: n })}#room`}
        route={route}
      />
      <MapLegend />
      <p className="mt-2 text-xs text-ink-2">Схема условная. Номер XYAB: крыло, этаж, номер аудитории.</p>
      {/* Та же схема списком: для экранных дикторов и тем, кому мелко на телефоне. */}
      <Disclosure title={`Все аудитории ${floor} этажа списком`} className="mt-3">
        <List>
          {plan.rooms
            .filter((r) => r.floor === floor)
            .map((r) => (
              <RowLink key={r.id} href={`${url({ room: r.number })}#room`}>
                <span className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <b className="font-semibold tabular-nums">{r.number}</b> · {r.title ?? roomKindLabel[r.kind]}, {r.capacity} мест
                  </span>
                  <span className="shrink-0 text-ink-2">
                    {state.busyNow.includes(r.id) ? "занята" : "свободна"}
                    {r.bookable ? " · бронь" : ""}
                  </span>
                </span>
              </RowLink>
            ))}
        </List>
      </Disclosure>
      </div>
      <div className="xl:sticky xl:top-6">

      {selected && roomDay ? (
        <ViewTransition key={`${selected.id}-${day}`} enter="fade-in" exit="fade-out" default="none">
          <section id="room" aria-label={`Аудитория ${selected.number}`} className="mt-6 scroll-mt-20 rounded-3xl bg-surface p-4 ring-1 ring-hairline md:scroll-mt-6 md:p-5 xl:mt-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-title font-bold tracking-tight tabular-nums">{selected.number}</h2>
                <p className="text-sm text-ink-2">
                  {selected.title ?? roomKindLabel[selected.kind]} · крыло {selected.wing}, {selected.floor} этаж
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-sm text-ink-2">
                <Users aria-hidden className="size-4" />
                {selected.capacity}
              </span>
            </div>
            <p className="mt-2 flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${ROOM_KIND_STYLE[selected.kind].soft} text-ink`}>
                {roomKindLabel[selected.kind]}
              </span>
              {selected.bookable ? (
                <Badge tone="ok">можно забронировать</Badge>
              ) : (
                <Badge>
                  <Lock aria-hidden className="mr-1 size-3" />
                  бронирует деканат
                </Badge>
              )}
            </p>

            <section aria-labelledby="route-title" className="mt-4 rounded-2xl bg-page p-3 ring-1 ring-hairline">
              <h3 id="route-title" className="flex items-center gap-2 font-semibold">
                <Route aria-hidden className="size-4 text-brand" />
                Как пройти
              </h3>
              <nav aria-label="Откуда идти" className="mt-2 flex flex-wrap gap-1.5">
                {starts.map((st) => {
                  const on = route && fromParam === st.from;
                  return (
                    <Link
                      key={st.from}
                      href={`${url({ from: st.from, floor: null })}#plan`}
                      replace
                      aria-current={on ? "true" : undefined}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors ${
                        on ? "bg-brand-fill text-on-brand" : "bg-surface text-ink ring-1 ring-hairline hover:bg-fill/70"
                      }`}
                    >
                      <st.icon aria-hidden className="size-4" />
                      {st.label}
                    </Link>
                  );
                })}
              </nav>
              {route && (
                <>
                  <p aria-live="polite" className="mt-3 text-sm text-ink-2">
                    Около {route.meters}&nbsp;м
                    {route.startFloor !== selected.floor ? `, с ${route.startFloor} на ${selected.floor} этаж` : ""}. Маршрут и расстояния примерные.
                  </p>
                  {blocks.map(({ floor: sf, steps }, bi) => (
                    <div key={bi} className="mt-3">
                      <p className="flex min-h-11 items-center justify-between gap-2 text-xs font-semibold text-ink-2">
                        {sf} этаж
                        {sf !== floor ? (
                          <Link href={`${url({ floor: sf })}#plan`} replace className="inline-flex min-h-11 items-center font-medium text-brand">
                            Показать на схеме
                          </Link>
                        ) : (
                          <span className="font-normal">на схеме</span>
                        )}
                      </p>
                      <ol className="space-y-2">
                        {steps.map((st, i) => {
                            const Icon = st.kind === "start" ? (fromEnd?.kind === "entrance" ? LogIn : DoorOpen) : STEP_ICON[st.kind];
                            return (
                              <li key={i} className="flex items-start gap-2.5 text-sm">
                                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-brand ring-1 ring-hairline">
                                  <Icon className={`size-4 ${st.kind === "down" ? "-scale-x-100" : ""}`} />
                                </span>
                                <span className="min-w-0 flex-1 pt-1">
                                  {st.text}
                                  {st.meters ? <span className="text-ink-2">, около {st.meters}&nbsp;м</span> : null}
                                </span>
                              </li>
                            );
                          })}
                      </ol>
                    </div>
                  ))}
                  <Link href={`${url({ from: null })}#room`} replace scroll={false} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand">
                    Скрыть маршрут
                  </Link>
                </>
              )}
              {here ? (
                <p aria-live="polite" className="mt-2 text-sm text-ink-2">
                  Вы уже в аудитории {selected.number}: прошлая пара была здесь же.
                </p>
              ) : (
                fromParam && !route && <p className="mt-2 text-sm text-ink-2">Маршрут построить не получилось: такой аудитории в корпусе нет. Выберите, откуда идти.</p>
              )}
              {/* Из любой аудитории корпуса: обычная форма GET, номер проверяет сервер по схеме. */}
              <Disclosure title="Из другой аудитории" className="mt-2">
                <form action={`/rooms/${building}`} className="flex items-end gap-2">
                  <input type="hidden" name="room" value={selected.number} />
                  <input type="hidden" name="d" value={day} />
                  <label className="min-w-0 flex-1 text-sm">
                    <span className="mb-1 block text-ink-2">Номер аудитории</span>
                    <input
                      name="from"
                      inputMode="numeric"
                      autoComplete="off"
                      list="plan-rooms"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      placeholder="например, 1121"
                      defaultValue={fromParam && fromParam !== "entrance" ? fromParam : ""}
                      className="min-h-11 w-full rounded-xl bg-surface px-3 text-body ring-1 ring-field outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    />
                  </label>
                  <datalist id="plan-rooms">
                    {plan.rooms
                      .filter((r) => r.number !== selected.number)
                      .map((r) => (
                        <option key={r.id} value={r.number} />
                      ))}
                  </datalist>
                  <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-brand-fill px-4 text-sm font-semibold text-on-brand transition active:scale-95">
                    Проложить
                  </button>
                </form>
              </Disclosure>
            </section>

            <nav aria-label="День" className="-mx-4 mt-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-5 md:px-5">
              {days.map((d) => (
                <Link
                  key={d}
                  href={`${url({ d })}#room`}
                  scroll={false}
                  replace
                  aria-current={d === day ? "date" : undefined}
                  className={`flex min-h-14 w-12 shrink-0 snap-start flex-col items-center justify-center rounded-2xl text-sm transition-colors ${
                    d === day ? "bg-brand-fill text-on-brand" : "bg-page text-ink ring-1 ring-hairline"
                  }`}
                >
                  <span className={`text-micro ${d === day ? "text-on-brand" : "text-ink-3"}`}>{weekday.format(noon(d))}</span>
                  <span className="font-semibold">{dayNum.format(noon(d))}</span>
                </Link>
              ))}
            </nav>

            <h3 className="mt-5 mb-2 text-lead font-semibold first-letter:uppercase">{formatDay(noon(day))}</h3>
            {roomDay.items.length ? (
              <List>
                {roomDay.items.map((it) =>
                  it.type === "lesson" ? (
                    <li key={it.key} className="flex items-center gap-3 px-3 py-2.5">
                      <KindTime kind={it.kind} start={formatTime(it.startsAt)} end={formatTime(it.endsAt)} struck={it.status === "CANCELLED"} />
                      <span className="min-w-0 flex-1 text-sm">
                        {it.lessonId ? (
                          <Link href={`/lessons/${it.lessonId}`} transitionTypes={["nav-forward"]} className="block font-medium text-brand">
                            {it.title}
                          </Link>
                        ) : (
                          <span className="block font-medium">{it.title}</span>
                        )}
                        <span className="block text-ink-2">
                          {lessonKindLabel[it.kind]} · {it.group}
                          {it.mine && " · ваша группа"}
                          {it.status === "CANCELLED" && " · отменено"}
                        </span>
                      </span>
                    </li>
                  ) : (
                    <li key={it.key} className="flex items-center gap-3 px-3 py-2.5">
                      <KindTime kind={it.mine ? "SPORT" : "CONSULTATION"} start={formatTime(it.startsAt)} end={formatTime(it.endsAt)} />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-medium">{it.mine ? "Ваша бронь" : "Занято: бронь"}</span>
                        {it.mine && it.purpose && <span className="block text-ink-2">{it.purpose}</span>}
                      </span>
                      {it.mine && it.bookingId && <CancelRoomBooking id={it.bookingId} />}
                    </li>
                  ),
                )}
              </List>
            ) : (
              <Empty>В этот день аудитория свободна.</Empty>
            )}

            {selected.bookable && (
              <div className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-lead font-semibold">
                  <CalendarClock aria-hidden className="size-5 text-brand" />
                  Забронировать
                </h3>
                <BookForm key={`${selected.id}-${day}`} roomId={selected.id} day={day} free={roomDay.free} />
                <p className="mt-3 text-xs text-ink-2">
                  Правила (демо): с {ROOM_RULES.opens} до {ROOM_RULES.closes}, от 30 минут до 3 часов, на {ROOM_RULES.windowDays} дней вперёд; не больше {ROOM_RULES.maxActive}{" "}
                  активных броней и одной в день.{selected.kind === "COWORKING" ? " Коворкинг бронируется целиком." : ""}
                </p>
              </div>
            )}
          </section>
        </ViewTransition>
      ) : (
        <Section title={`Можно забронировать на ${floor} этаже`} className="mt-6 xl:mt-0">
          {bookableHere.length ? (
            <List>
              {bookableHere.map((r) => (
                <RowLink key={r.id} href={`${url({ room: r.number })}#room`}>
                  <span className="flex items-center gap-3">
                    <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold tabular-nums ${ROOM_KIND_STYLE[r.kind].soft} text-ink`}>
                      {r.number.slice(-2)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {r.number} · {r.title ?? roomKindLabel[r.kind]}
                      </span>
                      <span className="block text-sm text-ink-2">
                        {r.capacity} мест{state.busyNow.includes(r.id) ? " · сейчас занята" : " · сейчас свободна"}
                      </span>
                    </span>
                  </span>
                </RowLink>
              ))}
            </List>
          ) : (
            <Empty>На этом этаже бронируемых аудиторий нет. Нажмите на любую аудиторию, чтобы увидеть её расписание.</Empty>
          )}
        </Section>
      )}
      </div>
      </div>
    </div>
  );
}
