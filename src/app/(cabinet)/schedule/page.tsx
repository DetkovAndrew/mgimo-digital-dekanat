import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, ViewTransition } from "react";
import { LessonCard } from "@/components/lesson-card";
import { TransferNote } from "@/components/transfer-note";
import { Empty, PageTitle, Section } from "@/components/ui";
import { addDays, formatDay, formatShortDate, mskDayKey, mskWeekStart } from "@/lib/format";
import { transfersForDay } from "@/lib/transfers";
import { getMySchedule } from "@/server/dal/schedule";

const weekdayShort = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "long" });
const dayMonth = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long" });
const dayNum = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric" });

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function weekLabel(offset: number) {
  if (offset === 0) return "Эта неделя";
  if (offset === 1) return "Следующая";
  if (offset === -1) return "Прошлая";
  return `${offset > 0 ? "+" : ""}${offset} нед.`;
}

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const { week } = await searchParams;
  const offset = Math.max(-20, Math.min(20, Number.parseInt(String(week ?? "0"), 10) || 0));
  const start = addDays(mskWeekStart(new Date()), offset * 7);
  const lessons = await getMySchedule({ from: start, to: addDays(start, 7) });
  const todayKey = mskDayKey(new Date());

  const days = Array.from({ length: 6 }, (_, i) => addDays(start, i))
    .map((d) => ({ date: d, key: mskDayKey(d), lessons: lessons.filter((l) => mskDayKey(l.startsAt) === mskDayKey(d)) }))
    .map((d) => ({ ...d, transfers: transfersForDay(d.lessons) }));

  const step = (n: number, label: string, Icon: typeof ChevronLeft) => (
    <Link
      href={`/schedule?week=${n}`}
      scroll={false}
      transitionTypes={[n > offset ? "nav-forward" : "nav-back"]}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full text-brand transition hover:bg-brand-soft active:scale-90"
    >
      <Icon aria-hidden className="size-5" />
    </Link>
  );

  return (
    <>
      <PageTitle>Расписание</PageTitle>
      <div className="mb-5 flex items-center justify-between rounded-2xl bg-surface p-1 ring-1 ring-hairline">
        {step(offset - 1, "Предыдущая неделя", ChevronLeft)}
        <span className="text-center">
          <span className="block text-sm font-semibold">{weekLabel(offset)}</span>
          <span className="block text-xs text-ink-2">
            {formatShortDate(start)} – {formatShortDate(addDays(start, 5))}
          </span>
        </span>
        {step(offset + 1, "Следующая неделя", ChevronRight)}
      </div>

      {/* Полоса дней: число пар точками, нажатие прокручивает к дню. На пустой неделе не нужна. */}
      {lessons.length > 0 && (
        <nav aria-label="Дни недели" className="mb-6 grid grid-cols-6 gap-1.5">
          {days.map((d) => {
            const on = d.key === todayKey;
            const count = d.lessons.filter((l) => l.status !== "CANCELLED").length;
            return (
              <a
                key={d.key}
                href={`#d-${d.key}`}
                aria-label={`${formatDay(d.date)}: ${count ? `занятий ${count}` : "нет занятий"}`}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors ${
                  on ? "bg-brand-fill text-on-brand" : "bg-surface text-ink ring-1 ring-hairline md:hover:bg-fill"
                }`}
              >
                <span className={`text-micro ${on ? "text-on-brand" : "text-ink-3"}`}>{weekdayShort.format(d.date)}</span>
                <span className="text-lead leading-none font-semibold tabular-nums">{dayNum.format(d.date)}</span>
                <span aria-hidden className="flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(count, 4) }, (_, i) => (
                    <span key={i} className={`size-1 rounded-full ${on ? "bg-on-brand" : "bg-brand"}`} />
                  ))}
                </span>
              </a>
            );
          })}
        </nav>
      )}

      <ViewTransition key={offset} enter="fade-in" exit="fade-out" default="none">
        <div>
          {lessons.length ? (
            days.map((d) => (
              <Section
                key={d.key}
                id={`d-${d.key}`}
                className="scroll-mt-20 md:scroll-mt-6"
                title={
                  <span className="flex items-baseline gap-2">
                    <span className={d.key === todayKey ? "text-brand" : ""}>{cap(weekdayLong.format(d.date))}</span>
                    <span className="text-sm font-normal text-ink-2">
                      {dayMonth.format(d.date)}
                      {d.key === todayKey && " · сегодня"}
                    </span>
                  </span>
                }
              >
                {d.lessons.length ? (
                  <div className="space-y-2">
                    {d.lessons.map((l) => {
                      const t = d.transfers.get(l.id);
                      return (
                        <Fragment key={l.id}>
                          <LessonCard lesson={l} />
                          {t && <TransferNote transfer={t} />}
                        </Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-1 text-sm text-ink-3">Нет занятий</p>
                )}
              </Section>
            ))
          ) : (
            <Empty>На этой неделе занятий нет.</Empty>
          )}
        </div>
      </ViewTransition>
    </>
  );
}
