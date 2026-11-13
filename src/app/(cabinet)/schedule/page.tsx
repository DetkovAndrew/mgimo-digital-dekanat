import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, ViewTransition } from "react";
import { LessonCard } from "@/components/lesson-card";
import { StudyEventRow } from "@/components/study-event";
import { TransferNote } from "@/components/transfer-note";
import { Empty, PageTitle, Section } from "@/components/ui";
import { addDays, formatDay, formatShortDate, mskDayKey, mskWeekStart } from "@/lib/format";
import { transfersForDay } from "@/lib/transfers";
import { getMyStudyEvents, getMyTerm, type StudyEvent } from "@/server/dal/grades";
import { getMySchedule, type ScheduleLesson } from "@/server/dal/schedule";

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

// Расписание: «Месяц» — календарь с переходом к любой дате (прошлое и сессия в том числе), «Неделя» — список.
// Сегодняшний день уже на «Сегодня», поэтому здесь по умолчанию месяц. Экзамены и сроки работ — в обоих видах.
export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const sp = await searchParams;
  const view = sp.view === "week" || (sp.view === undefined && sp.week !== undefined) ? "week" : "month";
  return (
    // Широкий экран: месяц в две колонки (календарь и день), неделя — обычной лентой.
    <div className="xl:-mx-40">
      <PageTitle>Расписание</PageTitle>
      <nav aria-label="Вид расписания" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-hairline xl:max-w-sm">
        {(
          [
            ["month", "Месяц", "/schedule"],
            ["week", "Неделя", "/schedule?view=week"],
          ] as const
        ).map(([v, label, href]) => (
          <Link
            key={v}
            href={href}
            replace
            scroll={false}
            transitionTypes={["nav-tab"]}
            aria-current={view === v ? "page" : undefined}
            className={`grid min-h-11 place-items-center rounded-xl text-sm font-semibold transition-colors ${view === v ? "bg-brand-fill text-on-brand" : "text-ink-2 hover:bg-fill"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {view === "week" ? (
        <div className="xl:mx-40">
          <WeekView week={sp.week} />
        </div>
      ) : (
        <MonthView m={sp.m} d={sp.d} />
      )}
    </div>
  );
}

/** Занятия, экзамены и сроки одного дня. */
function DayItems({ lessons, events }: { lessons: ScheduleLesson[]; events: StudyEvent[] }) {
  const transfers = transfersForDay(lessons);
  if (!lessons.length && !events.length) return <p className="px-1 text-sm text-ink-3">Нет занятий</p>;
  return (
    <div className="space-y-2">
      {events.map((e) => (
        <StudyEventRow key={e.id} event={e} />
      ))}
      {lessons.map((l) => {
        const t = transfers.get(l.id);
        return (
          <Fragment key={l.id}>
            <LessonCard lesson={l} />
            {t && <TransferNote transfer={t} />}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Месяц ──────────────────────────────────────────────────────────────────────────────────────────────────
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
const monthOf = (key: string) => key.slice(0, 7);
const dayStart = (key: string) => new Date(`${key}T00:00:00+03:00`);
const isExam = (e: StudyEvent) => e.kind === "EXAM" || e.kind === "CREDIT" || e.kind === "GRADED_CREDIT";

async function MonthView({ m, d }: { m: unknown; d: unknown }) {
  const todayKey = mskDayKey(new Date());
  const month = isMonth(m) ? m : isDay(d) ? monthOf(d) : monthOf(todayKey);
  const first = dayStart(`${month}-01`);
  const gridStart = mskWeekStart(first);
  const nextMonth = dayStart(`${shiftMonth(month, 1)}-01`);
  const weeks = Math.ceil((nextMonth.getTime() - gridStart.getTime()) / (7 * 86_400_000));
  const gridEnd = addDays(gridStart, weeks * 7);
  const [lessons, events, term] = await Promise.all([getMySchedule({ from: gridStart, to: gridEnd }), getMyStudyEvents({ from: gridStart, to: gridEnd }), getMyTerm()]);

  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(gridStart, i);
    const key = mskDayKey(date);
    return {
      date,
      key,
      inMonth: monthOf(key) === month,
      lessons: lessons.filter((l) => mskDayKey(l.startsAt) === key),
      events: events.filter((e) => mskDayKey(e.at) === key),
    };
  });
  // Выбранный день: из адреса, если он в этой сетке; иначе сегодня (если в этом месяце) или первое число.
  const selectedKey = isDay(d) && cells.some((c) => c.key === d) ? d : monthOf(todayKey) === month ? todayKey : `${month}-01`;
  const selected = cells.find((c) => c.key === selectedKey)!;
  const href = (p: { m?: string; d?: string }) => `/schedule?${new URLSearchParams({ m: p.m ?? month, ...(p.d ? { d: p.d } : {}) })}`;

  // Быстрые переходы: сегодня, первый экзамен сессии (а если их нет — её первый день), месяцы семестра и сессии.
  const sessionStart = term ? mskDayKey(term.sessionStartsOn) : null;
  const firstExam = term ? (await getMyStudyEvents({ from: term.sessionStartsOn, to: addDays(term.sessionEndsOn, 1) })).find(isExam) : undefined;
  const sessionDay = firstExam ? mskDayKey(firstExam.at) : sessionStart;
  const termMonths: string[] = [];
  if (term) for (let x = monthOf(mskDayKey(term.startsOn)); x <= monthOf(mskDayKey(term.sessionEndsOn)); x = shiftMonth(x, 1)) termMonths.push(x);
  const [y, mo] = month.split("-").map(Number);

  const arrow = (n: number, label: string, Icon: typeof ChevronLeft) => (
    <Link
      href={href({ m: shiftMonth(month, n) })}
      scroll={false}
      transitionTypes={[n > 0 ? "nav-forward" : "nav-back"]}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full text-brand transition hover:bg-brand-soft active:scale-90"
    >
      <Icon aria-hidden className="size-5" />
    </Link>
  );
  const chip = (to: string, label: string, on: boolean) => (
    <Link
      key={label}
      href={to}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium transition-colors ${on ? "bg-brand-fill text-on-brand" : "bg-surface text-ink ring-1 ring-hairline hover:bg-fill/70"}`}
    >
      {label}
    </Link>
  );

  return (
    // На широком экране календарь слева, выбранный день справа (как «Сегодня»).
    <div className="xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-8">
      <div>
      <nav aria-label="Быстрый переход" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {chip(href({ m: monthOf(todayKey), d: todayKey }), "Сегодня", selectedKey === todayKey)}
        {sessionDay && chip(href({ m: monthOf(sessionDay), d: sessionDay }), "Сессия", selectedKey === sessionDay)}
        {termMonths.map((x) => chip(href({ m: x }), MONTHS_SHORT[Number(x.slice(5)) - 1], x === month))}
      </nav>

      <section aria-label={`${MONTHS[mo - 1]} ${y}`} className="rounded-3xl bg-surface p-2 ring-1 ring-hairline md:p-3">
        <div className="flex items-center justify-between">
          {arrow(-1, "Предыдущий месяц", ChevronLeft)}
          <h2 className="text-lead font-semibold">
            {MONTHS[mo - 1]} {y}
          </h2>
          {arrow(1, "Следующий месяц", ChevronRight)}
        </div>
        <div aria-hidden className="mt-1 grid grid-cols-7 text-center text-micro font-semibold text-ink-3">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <ViewTransition key={month} enter="fade-in" exit="fade-out" default="none">
          <ol className="grid grid-cols-7 gap-0.5">
            {cells.map((c) => {
              const count = c.lessons.filter((l) => l.status !== "CANCELLED" && l.source === "lesson").length;
              const sport = c.lessons.some((l) => l.source === "sport");
              const exam = c.events.some(isExam);
              const due = c.events.some((e) => !isExam(e));
              const on = c.key === selectedKey;
              const today = c.key === todayKey;
              const label = [
                formatDay(c.date),
                today ? "сегодня" : null,
                count ? `занятий ${count}` : "нет занятий",
                exam ? `экзамен или зачёт: ${c.events.filter(isExam).map((e) => e.discipline).join(", ")}` : null,
                due ? "срок сдачи работы" : null,
                sport ? "физкультура" : null,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <li key={c.key}>
                  <Link
                    href={href({ d: c.key })}
                    replace
                    scroll={false}
                    aria-label={label}
                    aria-current={on ? "date" : undefined}
                    className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-sm tabular-nums transition-colors ${
                      on ? "bg-brand-fill font-semibold text-on-brand" : today ? "font-semibold text-brand ring-2 ring-brand ring-inset" : c.inMonth ? "text-ink hover:bg-fill" : "text-ink-3 hover:bg-fill"
                    }`}
                  >
                    <span>{Number(c.key.slice(8))}</span>
                    <span aria-hidden className="flex h-1.5 items-center gap-0.5">
                      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                        <span key={i} className={`size-1.5 rounded-full ${on ? "bg-on-brand" : "bg-brand"}`} />
                      ))}
                      {sport && <span className={`size-1.5 rounded-full ${on ? "bg-on-brand" : "bg-k-sport"}`} />}
                      {due && <span className={`size-1.5 rounded-full ${on ? "bg-on-brand" : "bg-warn"}`} />}
                      {exam && <span className={`size-2 rotate-45 rounded-[1px] ${on ? "bg-on-brand" : "bg-bad-fill"}`} />}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </ViewTransition>
        <ul aria-label="Обозначения" className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 text-xs text-ink-2">
          <li className="flex items-center gap-1">
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            пары
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden className="size-2 rotate-45 rounded-[1px] bg-bad-fill" />
            экзамен, зачёт
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden className="size-1.5 rounded-full bg-warn" />
            срок работы
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden className="size-1.5 rounded-full bg-k-sport" />
            физкультура
          </li>
        </ul>
      </section>
      </div>

      <div className="xl:sticky xl:top-6">
      <ViewTransition key={selectedKey} enter="fade-in" exit="fade-out" default="none">
        <Section
          className="mt-6 xl:mt-0"
          title={
            <span className="flex items-baseline gap-2">
              <span className={selectedKey === todayKey ? "text-brand" : ""}>{cap(weekdayLong.format(selected.date))}</span>
              <span className="text-sm font-normal text-ink-2">
                {dayMonth.format(selected.date)}
                {selectedKey === todayKey && " · сегодня"}
                {sessionStart && term && selectedKey >= sessionStart && selectedKey <= mskDayKey(term.sessionEndsOn) && " · сессия"}
              </span>
            </span>
          }
        >
          <DayItems lessons={selected.lessons} events={selected.events} />
        </Section>
      </ViewTransition>
      </div>
    </div>
  );
}

// ─── Неделя ─────────────────────────────────────────────────────────────────────────────────────────────────
async function WeekView({ week }: { week: unknown }) {
  const offset = Math.max(-40, Math.min(40, Number.parseInt(String(week ?? "0"), 10) || 0));
  const start = addDays(mskWeekStart(new Date()), offset * 7);
  const [lessons, events] = await Promise.all([getMySchedule({ from: start, to: addDays(start, 7) }), getMyStudyEvents({ from: start, to: addDays(start, 7) })]);
  const todayKey = mskDayKey(new Date());

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    .map((d) => ({ date: d, key: mskDayKey(d), lessons: lessons.filter((l) => mskDayKey(l.startsAt) === mskDayKey(d)), events: events.filter((e) => mskDayKey(e.at) === mskDayKey(d)) }))
    // Воскресенье — только если в нём что-то есть (физкультура, срок работы).
    .filter((d, i) => i < 6 || d.lessons.length || d.events.length);

  const step = (n: number, label: string, Icon: typeof ChevronLeft) => (
    <Link
      href={`/schedule?view=week&week=${n}`}
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
      <div className="mb-5 flex items-center justify-between rounded-2xl bg-surface p-1 ring-1 ring-hairline">
        {step(offset - 1, "Предыдущая неделя", ChevronLeft)}
        <span className="text-center">
          <span className="block text-sm font-semibold">{weekLabel(offset)}</span>
          <span className="block text-xs text-ink-2">
            {formatShortDate(start)} – {formatShortDate(addDays(start, days.length - 1))}
          </span>
        </span>
        {step(offset + 1, "Следующая неделя", ChevronRight)}
      </div>

      {/* Полоса дней: число пар точками, нажатие прокручивает к дню. На пустой неделе не нужна. */}
      {(lessons.length > 0 || events.length > 0) && (
        <nav aria-label="Дни недели" className="mb-6 grid auto-cols-fr grid-flow-col gap-1.5">
          {days.map((d) => {
            const on = d.key === todayKey;
            const count = d.lessons.filter((l) => l.status !== "CANCELLED").length + d.events.length;
            return (
              <a
                key={d.key}
                href={`#d-${d.key}`}
                aria-label={`${formatDay(d.date)}: ${count ? `событий ${count}` : "нет занятий"}`}
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
          {lessons.length || events.length ? (
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
                <DayItems lessons={d.lessons} events={d.events} />
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
