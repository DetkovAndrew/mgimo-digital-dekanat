import Link from "next/link";
import { Fragment } from "react";
import { LessonCard } from "@/components/lesson-card";
import { TransferNote } from "@/components/transfer-note";
import { Empty, PageTitle } from "@/components/ui";
import { addDays, formatDay, mskDayKey, mskWeekStart } from "@/lib/format";
import { transfersForDay } from "@/lib/transfers";
import { getMySchedule } from "@/server/dal/schedule";

function weekLabel(offset: number) {
  if (offset === 0) return "Эта неделя";
  if (offset === 1) return "Следующая неделя";
  if (offset === -1) return "Прошлая неделя";
  return `${offset > 0 ? "+" : ""}${offset} нед.`;
}

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const { week } = await searchParams;
  const offset = Math.max(-20, Math.min(20, Number.parseInt(String(week ?? "0"), 10) || 0));
  const start = addDays(mskWeekStart(new Date()), offset * 7);
  const lessons = await getMySchedule({ from: start, to: addDays(start, 7) });
  const todayKey = mskDayKey(new Date());

  const days = Array.from({ length: 6 }, (_, i) => addDays(start, i)).map((d) => ({
    date: d,
    key: mskDayKey(d),
    lessons: lessons.filter((l) => mskDayKey(l.startsAt) === mskDayKey(d)),
  })).map((d) => ({ ...d, transfers: transfersForDay(d.lessons) }));

  const nav = (n: number, label: string) => (
    <Link href={`/schedule?week=${n}`} className="rounded-lg px-3 py-2 text-sm text-brand hover:bg-brand/10">
      {label}
    </Link>
  );

  return (
    <>
      <PageTitle>Расписание</PageTitle>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-1 ring-1 ring-black/5">
        {nav(offset - 1, "← Пред.")}
        <span className="text-sm font-medium">{weekLabel(offset)}</span>
        {nav(offset + 1, "След. →")}
      </div>
      {lessons.length ? (
        <div className="space-y-5">
          {days.map((d) => (
            <section key={d.key}>
              <h2
                className={`mb-2 text-sm font-semibold first-letter:uppercase ${d.key === todayKey ? "text-brand" : ""}`}
              >
                {formatDay(d.date)} {d.key === todayKey && "· сегодня"}
              </h2>
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
                <p className="text-sm text-slate-400">Нет занятий</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Empty>На этой неделе занятий нет.</Empty>
      )}
    </>
  );
}
