import Link from "next/link";
import { Fragment } from "react";
import { LessonCard } from "@/components/lesson-card";
import { TransferNote } from "@/components/transfer-note";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { addDays, formatDate, formatDay, formatTime, mskStartOfDay, requestStatusLabel } from "@/lib/format";
import { yandexRouteUrl } from "@/lib/geo";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { transfersForDay } from "@/lib/transfers";
import { getMyUpcomingDeadlines } from "@/server/dal/grades";
import { getMyProfile } from "@/server/dal/profile";
import { listMyRequests } from "@/server/dal/requests";
import { getMySchedule } from "@/server/dal/schedule";

function minutesUntil(d: Date, now: Date) {
  const m = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (m < 60) return `через ${m} мин`;
  const h = Math.floor(m / 60);
  return h < 24 ? `через ${h} ч ${m % 60} мин` : `${formatDay(d)}`;
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

  return (
    <>
      <PageTitle>Привет, {firstName}!</PageTitle>
      <p className="-mt-3 mb-5 text-sm text-slate-500 first-letter:uppercase">
        {formatDay(now)} · {profile.group}
      </p>

      {next && (
        <Card className="mb-5 !bg-brand !text-white !ring-0">
          <p className="text-sm opacity-80">
            {ongoing ? "Сейчас идёт" : `Следующая пара ${minutesUntil(next.startsAt, now)}`}
          </p>
          <h2 className="mt-0.5 text-xl font-semibold leading-snug">
            <Link href={next.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
              {next.title} <span aria-hidden>›</span>
            </Link>
          </h2>
          <p className="mt-1 text-sm opacity-90">
            {formatTime(next.startsAt)}–{formatTime(next.endsAt)} ·{" "}
            {next.online ? "онлайн" : [next.room, next.building?.title].filter(Boolean).join(", ")}
          </p>
          {next.status === "RESCHEDULED" && <p className="mt-1 text-sm font-medium">⚠ Изменение в расписании</p>}
          {next.building && (
            <a
              href={yandexRouteUrl(next.building, "mt")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand"
            >
              Построить маршрут
            </a>
          )}
        </Card>
      )}

      {(needAction.length > 0 || impossible.length > 0 || deadlines.length > 0) && (
        <section className="mb-6" aria-labelledby="attention">
          <h2 id="attention" className="mb-2 font-semibold">
            Требует внимания
          </h2>
          <ul className="space-y-2">
            {needAction.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-amber-300"
                >
                  <span className="text-sm">
                    <b>{r.status === "NEEDS_INFO" ? "Деканат ждёт ответа" : "Справка готова"}</b>
                    <span className="block text-slate-500">
                      {isRequestType(r.type) ? requestCatalog[r.type].title : r.type} · {formatRequestNumber(r.number)}
                    </span>
                  </span>
                  <Badge tone={requestStatusLabel[r.status].tone}>{requestStatusLabel[r.status].label}</Badge>
                </Link>
              </li>
            ))}
            {impossible.map((t) => (
              <li key={t.afterLessonId} className="rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-red-200">
                <b>Сегодня не успеть на переход → {t.toTitle}</b>
                <span className="block text-slate-500">
                  Перерыв {t.verdict.kind === "impossible" && `${t.verdict.gapMin} мин, дорога ≈ ${t.verdict.estimate.transitMin} мин`}.
                </span>
              </li>
            ))}
            {deadlines.slice(0, 4).map((d) => (
              <li key={d.id}>
                <Link
                  href={`/courses/${d.offeringId}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
                >
                  <span className="text-sm">
                    <b>{d.title}</b>
                    <span className="block text-slate-500">
                      {d.discipline}
                      {d.maxPoints ? ` · до ${d.maxPoints} баллов` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-slate-500">до {formatDate(d.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Пары сегодня</h2>
          <Link href="/schedule" className="text-sm text-brand">
            Неделя
          </Link>
        </div>
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
      </section>

    </>
  );
}
