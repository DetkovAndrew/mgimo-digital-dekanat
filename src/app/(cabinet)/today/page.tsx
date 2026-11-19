import { ClipboardCheck, FileText, Footprints, QrCode } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { AskBar } from "@/components/assistant";
import { AutoRefresh } from "@/components/auto-refresh";
import { LessonCard } from "@/components/lesson-card";
import { NextLesson } from "@/components/next-lesson";
import { TransferNote } from "@/components/transfer-note";
import { Badge, Empty, IconTile, List, PageTitle, RowLink, Section } from "@/components/ui";
import { indoorRouteHref, lessonRoomOnPlan } from "@/lib/campus/route-link";
import { addDays, formatDay, formatShortDate, mskDayKey, mskStartOfDay, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { transfersForDay } from "@/lib/transfers";
import { getMyUpcomingDeadlines } from "@/server/dal/grades";
import { getMyProfile } from "@/server/dal/profile";
import { listMyRequests } from "@/server/dal/requests";
import { getMyRouteStart, getMySchedule } from "@/server/dal/schedule";

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
  // «Как пройти» внутри корпуса к следующей паре: из аудитории прошлой пары в тот же день, если она там же.
  const nextRoom = next ? lessonRoomOnPlan(next) : null;
  const indoorHref = next && nextRoom ? indoorRouteHref(nextRoom, mskDayKey(next.startsAt), await getMyRouteStart(nextRoom.buildingId, next.startsAt)) : null;
  const needAction = requests.filter((r) => r.status === "NEEDS_INFO" || r.status === "READY");
  // Только предстоящие переходы: утренние предупреждения вечером уже не актуальны.
  const impossible = [...transfers.values()].filter((t) => t.verdict.kind === "impossible" && t.toStartsAt > now);
  const firstName = profile.fullName.split(" ")[1] ?? profile.fullName;
  const attention = needAction.length + impossible.length + Math.min(3, deadlines.length);
  const side = "xl:col-start-2 xl:row-span-2 xl:row-start-1";

  return (
    // На широком экране две колонки: день слева, «требует внимания» справа; блок шире ленты остальных страниц.
    <div className="xl:-mx-40">
      <AutoRefresh />
      <PageTitle
        sub={formatDay(now)}
        aside={
          // Пропуск — на виду с главного экрана, без «Сервисов» и лишних нажатий (отзывы о my.itmo). На телефоне он
          // в шапке на каждом экране (значок QR), здесь — на широком экране рядом с приветствием.
          <Link
            href="/pass"
            transitionTypes={["nav-forward"]}
            className="hidden min-h-11 items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-brand ring-1 ring-hairline transition active:scale-95 md:inline-flex"
          >
            <QrCode aria-hidden className="size-4.5" />
            Пропуск
          </Link>
        }
      >
        Привет, {firstName}!
      </PageTitle>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start xl:gap-x-8">
        <div className="xl:col-start-1">
          {next && <NextLesson next={next} upcoming={upcoming} now={now} indoorHref={indoorHref} />}
          <AskBar className="mb-8" />
        </div>

        {attention > 0 ? (
          <Section title="Требует внимания" className={side}>
            <List>
              {needAction.map((r) => (
                <RowLink key={r.id} href={`/requests/${r.id}`}>
                  <span className="flex items-center gap-3">
                    <IconTile icon={FileText} tone={r.status === "NEEDS_INFO" ? "warn" : "ok"} />
                    <span className="min-w-0 flex-1">
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
                <li key={t.afterLessonId} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <IconTile icon={Footprints} tone="bad" />
                  <span className="min-w-0">
                    <b className="block font-medium text-bad">Не успеть на переход → {t.toTitle}</b>
                    <span className="block text-ink-2">
                      {t.verdict.kind === "impossible" && `Перерыв ${t.verdict.gapMin} мин, дорога ≈ ${t.verdict.estimate.transitMin} мин.`}
                    </span>
                  </span>
                </li>
              ))}
              {deadlines.slice(0, 3).map((d) => (
                <RowLink key={d.id} href={`/courses/${d.offeringId}`}>
                  <span className="flex items-center gap-3">
                    <IconTile icon={ClipboardCheck} tone="warn" />
                    <span className="min-w-0">
                      <span className="block font-medium">{d.title}</span>
                      <span className="block text-sm text-ink-2">
                        {d.discipline} · до {formatShortDate(d.at)}
                      </span>
                    </span>
                  </span>
                </RowLink>
              ))}
            </List>
          </Section>
        ) : (
          <Section title="Требует внимания" className={`hidden xl:block ${side}`}>
            <Empty>Срочного нет: заявки в работе, дедлайны далеко.</Empty>
          </Section>
        )}

        <Section
          className="xl:col-start-1"
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
            <Empty art="today">Сегодня пар нет, можно выдохнуть.</Empty>
          )}
        </Section>
      </div>
    </div>
  );
}
