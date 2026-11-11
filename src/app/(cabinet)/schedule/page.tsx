import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, ViewTransition } from "react";
import { LessonCard } from "@/components/lesson-card";
import { TransferNote } from "@/components/transfer-note";
import { Empty, PageTitle, Section } from "@/components/ui";
import { addDays, formatDay, formatShortDate, mskDayKey, mskWeekStart } from "@/lib/format";
import { transfersForDay } from "@/lib/transfers";
import { getMySchedule } from "@/server/dal/schedule";

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
            {formatShortDate(start)} — {formatShortDate(addDays(start, 5))}
          </span>
        </span>
        {step(offset + 1, "Следующая неделя", ChevronRight)}
      </div>

      <ViewTransition key={offset} enter="fade-in" exit="fade-out" default="none">
        <div>
          {lessons.length ? (
            days.map((d) => (
              <Section key={d.key} title={<span className={d.key === todayKey ? "text-brand" : ""}>{formatDay(d.date)}{d.key === todayKey && " · сегодня"}</span>}>
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
