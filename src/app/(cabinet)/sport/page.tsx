import { MapPin } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { CalendarIconLink } from "@/components/calendar-link";
import { KindTile, KindTime } from "@/components/kind";
import { Badge, Card, Empty, List, PageTitle, Section } from "@/components/ui";
import { formatDate, formatDay, formatTime, plural } from "@/lib/format";
import { getMySport } from "@/server/dal/sport";
import { Booked, BookButton, CancelBookingButton } from "./buttons";

const weekday = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "short" });
const dayNum = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric" });
const noon = (key: string) => new Date(`${key}T12:00:00+03:00`);

export default async function SportPage({ searchParams }: PageProps<"/sport">) {
  const { day } = await searchParams;
  const s = await getMySport(typeof day === "string" ? day : undefined);
  const p = s.progress;
  const pct = (n: number) => `${Math.min(100, (n / s.rules.total) * 100)}%`;

  return (
    <>
      <PageTitle sub={s.term}>Физкультура</PageTitle>

      <Card className="mb-8 rounded-3xl p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-h1 font-bold tracking-tight tabular-nums">
            {p.total}
            <span className="ml-1 text-body font-medium text-ink-2">из {s.rules.total} баллов</span>
          </p>
          {p.trainingsNeeded === 0 ? (
            <Badge tone="ok">минимум за тренировки набран</Badge>
          ) : (
            <span className="text-sm text-ink-2">ещё {p.trainingsNeeded} {plural(p.trainingsNeeded, "тренировка", "тренировки", "тренировок")}</span>
          )}
        </div>
        <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-fill" role="img" aria-label={`${p.total} из ${s.rules.total}`}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-brand-fill" style={{ width: pct(p.trainingPoints) }} />
          <div className="absolute inset-y-0 rounded-full bg-accent" style={{ left: pct(p.trainingPoints), width: pct(p.extraPoints) }} />
          <span className="absolute inset-y-0 w-px bg-surface" style={{ left: pct(s.rules.trainingMin) }} />
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-brand-fill" />
            {p.trainingPoints} из {s.rules.trainingMin} за тренировки
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-accent" />
            {p.extraPoints} дополнительно
          </span>
        </p>
        <details className="group mt-1 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-brand">
            <span className="group-open:hidden">Подробнее и правила</span>
            <span className="hidden group-open:inline">Скрыть</span>
          </summary>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">
            <li>
              Посещено {p.attended}
              {p.missed > 0 && `, пропусков без отмены ${p.missed}`}.
              {p.extra.map((e) => ` ${e.title}: +${e.points} (${formatDate(e.awardedAt)}).`).join("")}
            </li>
            <li>
              Запись открывается за {s.rules.windowDays} дней: есть место — вы записаны сразу. Не больше{" "}
              {s.rules.weeklyQuota} тренировок в неделю и одной в день.
            </li>
            <li>Тренировки, которые пересекаются с парами или до которых не успеть дойти, система не даст выбрать и объяснит почему.</li>
            <li>
              Мест нет — можно встать в очередь: освободится место, запишем первого подходящего и пришлём уведомление. За{" "}
              {s.rules.queueFreezeHours} часов до начала очередь замирает, чтобы накануне было ясно, ехать или нет.
            </li>
            <li>Тренировка — {s.rules.pointsPerTraining} баллов; для зачёта — 60 за тренировки и 100 всего (правила University, демо).</li>
          </ul>
        </details>
      </Card>

      {s.bookings.length > 0 && (
        <Section title="Мои записи">
          <List>
            {s.bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <KindTile kind="SPORT" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <b className="font-semibold">{b.slot.section.title}</b>
                    {b.status === "WAITLIST" ? (
                      <Badge tone="warn">{b.frozen ? "очередь закрыта" : `в очереди · ${b.position}-й`}</Badge>
                    ) : b.conflict ? (
                      <Badge tone="bad">конфликт</Badge>
                    ) : (
                      <Badge tone="ok">записаны</Badge>
                    )}
                  </span>
                  <span className="block text-sm text-ink-2 first-letter:uppercase">
                    {formatDay(b.slot.startsAt)}, {formatTime(b.slot.startsAt)}–{formatTime(b.slot.endsAt)}
                  </span>
                  <span className="block text-xs text-ink-2">
                    {b.slot.building.title} · {b.slot.room}
                  </span>
                  {b.status === "WAITLIST" && !b.frozen && (
                    <span className="block text-xs text-warn">Место пока не подтверждено</span>
                  )}
                  {b.conflict && <span className="block text-xs text-bad">Расписание изменилось: {b.conflict}</span>}
                </span>
                {b.status === "CONFIRMED" && <CalendarIconLink kind="sport" id={b.id} label={b.slot.section.title} />}
                <CancelBookingButton id={b.id} waitlist={b.status === "WAITLIST"} />
              </li>
            ))}
          </List>
        </Section>
      )}

      <Section title="Записаться">
        <nav aria-label="День" className="-mx-4 mb-3 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {s.days.map((d) => {
            const on = d === s.day;
            return (
              <Link
                key={d}
                href={`/sport?day=${d}`}
                scroll={false}
                replace
                aria-current={on ? "date" : undefined}
                className={`flex min-h-14 w-12 shrink-0 snap-start flex-col items-center justify-center rounded-2xl text-sm transition-colors ${
                  on ? "bg-brand-fill text-on-brand" : "bg-surface text-ink ring-1 ring-hairline"
                }`}
              >
                <span className={`text-micro ${on ? "text-on-brand" : "text-ink-3"}`}>{weekday.format(noon(d))}</span>
                <span className="font-semibold">{dayNum.format(noon(d))}</span>
              </Link>
            );
          })}
        </nav>

        <ViewTransition key={s.day} enter="fade-in" exit="fade-out" default="none">
          <div>
            {s.slots.length ? (
              <List>
                {s.slots.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                    <KindTime kind="SPORT" start={formatTime(x.startsAt)} end={formatTime(x.endsAt)} />
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug font-medium">{x.section.title}</span>
                      <span className="flex items-center gap-1 text-xs text-ink-2">
                        <MapPin aria-hidden className="size-3 shrink-0" />
                        <span className="truncate">
                          {x.building.title} · {x.room}
                        </span>
                      </span>
                      <span className={`block text-xs ${x.free ? "text-ink-2" : "text-warn"}`}>
                        {x.free ? `свободно ${x.free} из ${x.capacity}` : `мест нет${x.queue ? ` · в очереди ${x.queue}` : ""}`}
                      </span>
                      {x.note && <span className="block text-xs text-ink-2">{x.note}</span>}
                    </span>
                    {x.action === "booked" || x.action === "queued" ? (
                      <Booked queued={x.action === "queued"} />
                    ) : x.action === "book" || x.action === "queue" ? (
                      <BookButton slotId={x.id} queue={x.action === "queue"} />
                    ) : null}
                  </li>
                ))}
              </List>
            ) : (
              <Empty>В этот день тренировок нет.</Empty>
            )}
          </div>
        </ViewTransition>
      </Section>
    </>
  );
}
