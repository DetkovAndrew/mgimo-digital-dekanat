import { BookOpen, ClipboardCheck, MapPin, Navigation, Route, UserRound } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { BackLink } from "@/components/back-link";
import { KindTile, kindStyle } from "@/components/kind";
import { CalendarButton } from "@/components/calendar-link";
import { Badge, Card, Disclosure, IconTile, List, RowLink, Section } from "@/components/ui";
import { indoorRouteHref, lessonRoomOnPlan } from "@/lib/campus/route-link";
import { formatDate, formatDateTime, formatDay, formatTime, lessonKindLabel, mskDayKey } from "@/lib/format";
import { yandexRouteUrl } from "@/lib/geo";
import { lessonTitleName } from "@/lib/view-transitions";
import { getMyLesson, type MyLesson } from "@/server/dal/lessons";
import { getMyRouteStart } from "@/server/dal/schedule";

const statusText: Record<string, string> = { RESCHEDULED: "перенесено", CANCELLED: "отменено" };

function ChangeLine({ c, titles }: { c: MyLesson["changes"][number]; titles: Record<string, string> }) {
  const when = (from: Date, to: Date) => `${formatDateTime(from)}–${formatTime(to)}`;
  const where = (room: string | null, b: string | null) => [room, b ? titles[b] : null].filter(Boolean).join(", ") || "онлайн";
  return (
    <li className="px-4 py-3 text-sm">
      <span className="block text-xs text-ink-3">{formatDateTime(c.createdAt)}</span>
      {c.newStatus === "CANCELLED" ? (
        <>Отменено.</>
      ) : (
        <>
          {when(c.previousStartsAt, c.previousEndsAt)}, {where(c.previousRoom, c.previousBuildingId)} →{" "}
          <b className="font-semibold">
            {when(c.newStartsAt, c.newEndsAt)}, {where(c.newRoom, c.newBuildingId)}
          </b>
        </>
      )}
      {c.reason && <span className="block text-ink-2">{c.reason}</span>}
    </li>
  );
}

export default async function LessonPage({ params }: PageProps<"/lessons/[id]">) {
  const { id } = await params;
  const l = await getMyLesson(id);
  const cancelled = l.status === "CANCELLED";
  const latest = l.changes[0];
  // Аудитория со схемы корпуса: ссылка на её расписание и бронь в день пары и маршрут внутри корпуса —
  // из аудитории предыдущей пары в этот день, если она была здесь же, иначе от входа.
  const onPlanRoom = lessonRoomOnPlan(l);
  const day = mskDayKey(l.startsAt);
  const roomHref = onPlanRoom ? `/rooms/${onPlanRoom.buildingId}?${new URLSearchParams({ room: onPlanRoom.number, d: day })}#room` : null;
  const indoorHref = onPlanRoom && !cancelled ? indoorRouteHref(onPlanRoom, day, await getMyRouteStart(onPlanRoom.buildingId, l.startsAt)) : null;

  return (
    <>
      <BackLink href="/schedule">Расписание</BackLink>
      <p className="flex items-center gap-2 text-sm">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${kindStyle(l.kind).soft} ${kindStyle(l.kind).text}`}>
          {lessonKindLabel[l.kind]}
        </span>
        {statusText[l.status] && <Badge tone={cancelled ? "bad" : "warn"}>{statusText[l.status]}</Badge>}
      </p>
      <ViewTransition name={lessonTitleName(l.id)} share="morph" default="none">
        <h1 className={`mt-1 w-fit text-h1 font-bold tracking-tight ${cancelled ? "line-through" : ""}`}>{l.title}</h1>
      </ViewTransition>
      <p className="mt-1 mb-5 text-lead text-ink first-letter:uppercase">
        {formatDay(l.startsAt)} · {formatTime(l.startsAt)}–{formatTime(l.endsAt)}
      </p>

      {latest && !!statusText[l.status] && (
        <p className="mb-5 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
          {cancelled ? "Пара отменена." : `Было: ${formatDateTime(latest.previousStartsAt)}${latest.previousRoom ? `, ${latest.previousRoom}` : ""}.`}{" "}
          {latest.reason}
        </p>
      )}

      <Card className="mb-6">
        {l.online ? (
          <p>Онлайн — ссылку пришлёт преподаватель.</p>
        ) : l.building ? (
          <>
            <div className="flex items-start gap-3">
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
              <div className="min-w-0">
                {roomHref ? (
                  <Link href={roomHref} transitionTypes={["nav-forward"]} className="inline-flex min-h-11 items-center font-semibold text-brand">
                    {l.room} · на схеме
                  </Link>
                ) : (
                  <p className="font-semibold">{l.room ?? "Аудитория не указана"}</p>
                )}
                <Link href={`/buildings/${l.building.id}`} transitionTypes={["nav-forward"]} className="inline-flex min-h-11 items-center text-brand">
                  {l.building.title}
                </Link>
                {l.building.metro && <p className="-mt-2 text-sm text-ink-2">м. {l.building.metro}</p>}
              </div>
            </div>
            {!cancelled && (
              <a
                href={yandexRouteUrl(l.building, "mt")}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-fill text-body font-semibold text-on-brand transition active:scale-[0.98]"
              >
                <Navigation aria-hidden className="size-4" />
                Как доехать до корпуса
              </a>
            )}
            {indoorHref && (
              <Link
                href={indoorHref}
                transitionTypes={["nav-forward"]}
                className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface text-body font-semibold text-brand ring-1 ring-hairline transition active:scale-[0.98]"
              >
                <Route aria-hidden className="size-4" />
                Как пройти к аудитории
              </Link>
            )}
          </>
        ) : (
          <p className="text-ink-2">Аудитория не указана.</p>
        )}
        <CalendarButton kind="lesson" id={l.id} />
      </Card>

      <Section title="Преподаватель">
        <List>
          <RowLink href={`/teachers/${l.teacher.id}`}>
            <span className="flex items-center gap-3">
              <IconTile icon={UserRound} tone="neutral" />
              <span className="min-w-0">
                <span className="block font-medium">{l.teacher.fullName}</span>
                {l.teacher.position && <span className="block text-sm text-ink-2">{l.teacher.position} · расписание</span>}
              </span>
            </span>
          </RowLink>
        </List>
      </Section>

      <Section title="Дисциплина">
        <List>
          <RowLink href={`/courses/${l.offeringId}`}>
            <span className="flex items-center gap-3">
              <IconTile icon={BookOpen} />
              <span className="font-medium">Баллы и контрольные</span>
            </span>
          </RowLink>
          {l.next && (
            <RowLink href={`/lessons/${l.next.id}`}>
              <span className="flex items-center gap-3">
                <KindTile kind={l.next.kind} />
                <span className="min-w-0">
                  <span className="block font-medium">
                    Следующая: {lessonKindLabel[l.next.kind].toLowerCase()}, {formatDay(l.next.startsAt)}
                  </span>
                  <span className="block text-sm text-ink-2">
                    {formatTime(l.next.startsAt)} · {l.next.online ? "онлайн" : [l.next.room, l.next.building?.title].filter(Boolean).join(", ")}
                  </span>
                </span>
              </span>
            </RowLink>
          )}
          {l.deadlines.map((d) => (
            <RowLink key={d.id} href={`/courses/${l.offeringId}`}>
              <span className="flex items-center gap-3">
                <IconTile icon={ClipboardCheck} tone="info" />
                <span className="min-w-0">
                  <span className="block font-medium">{d.title}</span>
                  <span className="block text-sm text-ink-2">
                    до {formatDate(d.at)}
                    {d.maxPoints ? ` · до ${d.maxPoints} баллов` : ""}
                  </span>
                </span>
              </span>
            </RowLink>
          ))}
        </List>
      </Section>

      {l.changes.length > 0 && (
        <Disclosure title={`История изменений (${l.changes.length})`} className="">
          <List>
            {l.changes.map((c) => (
              <ChangeLine key={c.id} c={c} titles={l.buildingTitles} />
            ))}
          </List>
        </Disclosure>
      )}
    </>
  );
}
