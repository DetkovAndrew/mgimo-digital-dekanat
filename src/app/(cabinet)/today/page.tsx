import { ChevronRight, Navigation } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { LessonCard } from "@/components/lesson-card";
import { TransferNote } from "@/components/transfer-note";
import { Badge, Empty, List, PageTitle, RowLink, Section } from "@/components/ui";
import { addDays, formatDay, formatShortDate, formatTime, mskDayKey, mskStartOfDay, requestStatusLabel } from "@/lib/format";
import { yandexRouteUrl } from "@/lib/geo";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { transfersForDay } from "@/lib/transfers";
import { getMyUpcomingDeadlines } from "@/server/dal/grades";
import { getMyProfile } from "@/server/dal/profile";
import { listMyRequests } from "@/server/dal/requests";
import { getMySchedule } from "@/server/dal/schedule";

function startsIn(d: Date, now: Date) {
  const m = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (m < 60) return `через ${m} мин`;
  if (mskDayKey(d) === mskDayKey(now)) return `через ${Math.floor(m / 60)} ч ${m % 60} мин`;
  if (mskDayKey(d) === mskDayKey(addDays(now, 1))) return "завтра";
  return formatDay(d);
}

export default async function TodayPage() {
  const now = new Date();
  const today = mskStartOfDay(now);
  const [profile, upcoming, requests, deadlines] = await Promise.all([
    getMyProfile(),
    getMySchedule({ from: today, to: addDays(today, 8) }),
    listMyRequests(),
    getMyUpcomingDeadlines({ from: now, to: addDays(now, 8) }),
  ]);

  const todayLessons = upcoming.filter((l) => l.startsAt < addDays(today, 1));
  const transfers = transfersForDay(todayLessons);
  const next = upcoming.find((l) => l.status !== "CANCELLED" && l.endsAt > now);
  const ongoing = next && next.startsAt <= now;
  const needAction = requests.filter((r) => r.status === "NEEDS_INFO" || r.status === "READY");
  // Только предстоящие переходы: утренние предупреждения вечером уже не актуальны.
  const impossible = [...transfers.values()].filter((t) => t.verdict.kind === "impossible" && t.toStartsAt > now);
  const firstName = profile.fullName.split(" ")[1] ?? profile.fullName;
  const attention = needAction.length + impossible.length + Math.min(3, deadlines.length);

  return (
    <>
      <PageTitle sub={`${formatDay(now)} · ${profile.group}`}>Привет, {firstName}!</PageTitle>

      {next && (
        <section className="mb-6 overflow-hidden rounded-3xl bg-brand-fill p-5 text-on-brand">
          <p className="text-sm font-medium text-on-brand">{ongoing ? "Сейчас идёт" : `Следующая пара — ${startsIn(next.startsAt, now)}`}</p>
          <Link href={next.href} transitionTypes={["nav-forward"]} className="group mt-1 flex min-h-11 items-center gap-1 focus-visible:outline-focus-on-brand">
            <h2 className="text-[22px] leading-snug font-bold">{next.title}</h2>
            <ChevronRight aria-hidden className="size-5 shrink-0 opacity-70 transition group-hover:translate-x-0.5" />
          </Link>
          <p className="text-[15px] text-on-brand">
            {formatTime(next.startsAt)}–{formatTime(next.endsAt)} · {next.online ? "онлайн" : [next.room, next.building?.title].filter(Boolean).join(", ")}
          </p>
          {next.status === "RESCHEDULED" && <p className="mt-1 text-sm font-medium">Есть изменение в расписании</p>}
          {next.building && (
            <a
              href={yandexRouteUrl(next.building, "mt")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-5 text-sm font-semibold text-brand transition active:scale-95"
            >
              <Navigation aria-hidden className="size-4" />
              Маршрут
            </a>
          )}
        </section>
      )}

      {attention > 0 && (
        <Section title="Требует внимания">
          <List>
            {needAction.map((r) => (
              <RowLink key={r.id} href={`/requests/${r.id}`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{r.status === "NEEDS_INFO" ? "Деканат ждёт ответа" : "Справка готова"}</span>
                    <span className="block text-sm text-ink-2">
                      {isRequestType(r.type) ? requestCatalog[r.type].title : r.type} · {formatRequestNumber(r.number)}
                    </span>
                  </span>
                  <Badge tone={requestStatusLabel[r.status].tone}>{requestStatusLabel[r.status].label}</Badge>
                </span>
              </RowLink>
            ))}
            {impossible.map((t) => (
              <li key={t.afterLessonId} className="px-4 py-3 text-sm">
                <b className="font-medium text-bad">Не успеть на переход → {t.toTitle}</b>
                <span className="block text-ink-2">
                  {t.verdict.kind === "impossible" && `Перерыв ${t.verdict.gapMin} мин, дорога ≈ ${t.verdict.estimate.transitMin} мин.`}
                </span>
              </li>
            ))}
            {deadlines.slice(0, 3).map((d) => (
              <RowLink key={d.id} href={`/courses/${d.offeringId}`}>
                <span className="block font-medium">{d.title}</span>
                <span className="block text-sm text-ink-2">
                  {d.discipline} · до {formatShortDate(d.at)}
                </span>
              </RowLink>
            ))}
          </List>
        </Section>
      )}

      <Section
        title="Сегодня"
        aside={
          <Link href="/schedule" transitionTypes={["nav-tab"]} className="inline-flex min-h-11 items-center text-sm text-brand">
            Вся неделя
          </Link>
        }
      >
        {todayLessons.length ? (
          <div className="space-y-2">
            {todayLessons.map((l) => {
              const t = transfers.get(l.id);
              return (
                <Fragment key={l.id}>
                  <LessonCard lesson={l} />
                  {t && <TransferNote transfer={t} />}
                </Fragment>
              );
            })}
          </div>
        ) : (
          <Empty>Сегодня пар нет — можно выдохнуть.</Empty>
        )}
      </Section>
    </>
  );
}
