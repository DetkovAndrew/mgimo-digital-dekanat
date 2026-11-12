import { ChevronRight, MapPin, Navigation, UserRound } from "lucide-react";
import Link from "next/link";
import { addDays, formatDay, formatTime, lessonKindLabel, mskDayKey, mskStartOfDay } from "@/lib/format";
import { yandexRouteUrl } from "@/lib/geo";
import type { ScheduleLesson } from "@/server/dal/schedule";

function startsIn(d: Date, now: Date) {
  const m = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (m < 60) return `через ${m} мин`;
  if (mskDayKey(d) === mskDayKey(now)) return `через ${Math.floor(m / 60)} ч ${m % 60} мин`;
  if (mskDayKey(d) === mskDayKey(addDays(now, 1))) return "завтра";
  return formatDay(d);
}

/** «Садыков Ренат Ильдарович» → «Садыков Р. И.»: на карточке важна фамилия. */
const shortName = (full: string) => {
  const [last, ...rest] = full.split(" ");
  return [last, ...rest.map((p) => `${p[0]}.`)].join(" ");
};

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

/** Лента дня: пары как отрезки на шкале времени, текущий момент отмечен чертой. Только украшение: список пар ниже. */
function DayStrip({ lessons, next, now }: { lessons: ScheduleLesson[]; next: ScheduleLesson; now: Date }) {
  const day = mskStartOfDay(next.startsAt);
  const min = (d: Date) => (d.getTime() - day.getTime()) / 60_000;
  const from = Math.min(8 * 60, Math.floor(min(lessons[0].startsAt) / 60) * 60);
  const lastEnd = Math.max(...lessons.map((l) => min(l.endsAt)));
  const to = Math.max(20 * 60, Math.ceil(lastEnd / 60) * 60);
  const pos = (m: number) => `${((m - from) / (to - from)) * 100}%`;
  const nowMin = mskDayKey(now) === mskDayKey(next.startsAt) ? min(now) : null;

  return (
    <div aria-hidden className="relative mt-5 h-2.5">
      <span className="absolute inset-0 rounded-full bg-on-brand/20" />
      {lessons.map((l) => (
        <span
          key={l.id}
          className={`absolute inset-y-0 rounded-full ${l.id === next.id ? "bg-on-brand" : l.endsAt <= now ? "bg-on-brand/35" : "bg-on-brand/60"}`}
          style={{ left: pos(min(l.startsAt)), width: `${((min(l.endsAt) - min(l.startsAt)) / (to - from)) * 100}%` }}
        />
      ))}
      {nowMin !== null && nowMin > from && nowMin < to && (
        <span className="absolute -inset-y-1.5 w-0.75 -translate-x-1/2 rounded-full bg-on-brand ring-2 ring-brand-fill" style={{ left: pos(nowMin) }} />
      )}
    </div>
  );
}

/** Главная карточка «Сегодня»: следующая пара крупно, место и преподаватель, лента дня и маршрут. */
export function NextLesson({ next, upcoming, now }: { next: ScheduleLesson; upcoming: ScheduleLesson[]; now: Date }) {
  const ongoing = next.startsAt <= now;
  const day = upcoming.filter((l) => l.status !== "CANCELLED" && mskDayKey(l.startsAt) === mskDayKey(next.startsAt));
  const left = day.filter((l) => l.endsAt > now);
  const isToday = mskDayKey(next.startsAt) === mskDayKey(now);
  const place = next.online ? "Онлайн" : [next.room, next.building?.title].filter(Boolean).join(" · ");
  const dayEnd = left.reduce((m, l) => (l.endsAt > m ? l.endsAt : m), next.endsAt);
  const leftMin = Math.max(1, Math.round((next.endsAt.getTime() - now.getTime()) / 60_000));

  return (
    <section aria-label="Следующая пара" className="mb-3 rounded-3xl bg-brand-fill p-5 text-on-brand md:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-brand">{lessonKindLabel[next.kind]}</span>
        <p className="text-sm font-medium tabular-nums">{ongoing ? `идёт · ещё ${leftMin} мин` : startsIn(next.startsAt, now)}</p>
      </div>

      <p className="mt-4 leading-none font-bold tracking-[-0.03em] tabular-nums">
        <span className="text-display">{formatTime(next.startsAt)}</span>
        <span className="ml-2 text-title font-semibold tracking-tight">до {formatTime(next.endsAt)}</span>
      </p>

      <Link
        href={next.href}
        transitionTypes={["nav-forward"]}
        className="group mt-3 flex min-h-11 w-fit items-center gap-1 focus-visible:outline-focus-on-brand"
      >
        <h2 className="text-title leading-snug font-semibold tracking-tight">{next.title}</h2>
        <ChevronRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body">
        <li className="flex min-w-0 items-center gap-1.5">
          <MapPin aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{place || "Аудитория не указана"}</span>
        </li>
        {next.teacher && (
          <li className="flex items-center gap-1.5">
            <UserRound aria-hidden className="size-4 shrink-0" />
            {shortName(next.teacher)}
          </li>
        )}
      </ul>
      {next.status === "RESCHEDULED" && <p className="mt-2 text-sm font-medium">Есть изменение: подробности на странице пары</p>}

      {day.length > 0 && <DayStrip lessons={day} next={next} now={now} />}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {isToday ? "Сегодня" : "В этот день"}{" "}
          {day.length === 1 ? "одна пара" : left.length > 1 ? `ещё ${left.length} ${plural(left.length, "пара", "пары", "пар")}` : "это последняя пара"}
          {left.length > 1 && `, до ${formatTime(dayEnd)}`}
        </p>
        {next.building && !next.online && (
          <a
            href={yandexRouteUrl(next.building, "mt")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-semibold text-brand transition active:scale-95 focus-visible:outline-focus-on-brand"
          >
            <Navigation aria-hidden className="size-4" />
            Маршрут
          </a>
        )}
      </div>
    </section>
  );
}
