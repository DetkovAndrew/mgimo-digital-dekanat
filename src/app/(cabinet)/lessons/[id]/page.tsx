import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Badge, Card } from "@/components/ui";
import { formatDate, formatDateTime, formatDay, formatTime, lessonKindLabel } from "@/lib/format";
import { yandexRouteUrl } from "@/lib/geo";
import { getMyLesson, type MyLesson } from "@/server/dal/lessons";

const statusText: Record<string, string> = { SCHEDULED: "по расписанию", RESCHEDULED: "перенесено", CANCELLED: "отменено" };

function ChangeLine({ c, titles }: { c: MyLesson["changes"][number]; titles: Record<string, string> }) {
  const when = (from: Date, to: Date) => `${formatDateTime(from)}–${formatTime(to)}`;
  const where = (room: string | null, b: string | null) => [room, b ? titles[b] : null].filter(Boolean).join(", ") || "онлайн";
  return (
    <li className="py-2 text-sm">
      <span className="block text-xs text-slate-500">{formatDateTime(c.createdAt)}</span>
      {c.newStatus === "CANCELLED" ? (
        <>Отменено.</>
      ) : (
        <>
          {when(c.previousStartsAt, c.previousEndsAt)}, {where(c.previousRoom, c.previousBuildingId)} →{" "}
          <b>
            {when(c.newStartsAt, c.newEndsAt)}, {where(c.newRoom, c.newBuildingId)}
          </b>
        </>
      )}
      {c.reason && <span className="block text-slate-600">{c.reason}</span>}
    </li>
  );
}

export default async function LessonPage({ params }: PageProps<"/lessons/[id]">) {
  const { id } = await params;
  const l = await getMyLesson(id);
  const cancelled = l.status === "CANCELLED";
  const latest = l.changes[0];

  return (
    <>
      <BackLink href="/schedule">Расписание</BackLink>
      <p className="text-sm text-slate-500">
        {lessonKindLabel[l.kind]}
        {l.status !== "SCHEDULED" && (
          <>
            {" "}
            · <Badge tone={cancelled ? "bad" : "warn"}>{statusText[l.status]}</Badge>
          </>
        )}
      </p>
      <h1 className={`mt-1 text-2xl font-semibold leading-tight tracking-tight ${cancelled ? "line-through" : ""}`}>
        <Link href={`/courses/${l.offeringId}`} className="inline-flex min-h-11 items-center hover:text-brand">
          {l.title}
        </Link>
      </h1>
      <p className="mt-1 mb-4 text-slate-700 first-letter:uppercase">
        {formatDay(l.startsAt)}, {formatTime(l.startsAt)}–{formatTime(l.endsAt)}
      </p>

      {latest && l.status !== "SCHEDULED" && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {cancelled ? "Пара отменена." : `Было: ${formatDateTime(latest.previousStartsAt)}${latest.previousRoom ? `, ${latest.previousRoom}` : ""}.`}{" "}
          {latest.reason}
        </p>
      )}

      <Card className="mb-3">
        <h2 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Где</h2>
        {l.online ? (
          <p>Онлайн — ссылку пришлёт преподаватель.</p>
        ) : l.building ? (
          <>
            <p className="font-medium">
              {l.room && `${l.room}, `}
              <Link href={`/buildings/${l.building.id}`} className="inline-flex min-h-11 items-center text-brand">
                {l.building.title}
              </Link>
            </p>
            <p className="text-sm text-slate-500">
              {l.building.address}
              {l.building.metro && ` · м. ${l.building.metro}`}
            </p>
            {!cancelled && (
              <a
                href={yandexRouteUrl(l.building, "mt")}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white"
              >
                Маршрут в Яндекс Картах
              </a>
            )}
          </>
        ) : (
          <p className="text-slate-500">Аудитория не указана.</p>
        )}
      </Card>

      <Card className="mb-3">
        <h2 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Преподаватель</h2>
        <Link href={`/teachers/${l.teacher.id}`} className="flex min-h-11 items-center justify-between gap-3">
          <span>
            <span className="block font-medium">{l.teacher.fullName}</span>
            {l.teacher.position && <span className="block text-sm text-slate-500">{l.teacher.position}</span>}
          </span>
          <span className="text-sm text-brand">Расписание ›</span>
        </Link>
      </Card>

      {(l.next || l.deadlines.length > 0) && (
        <Card className="mb-3">
          <h2 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Дальше по дисциплине</h2>
          <ul className="divide-y divide-slate-100">
            {l.next && (
              <li>
                <Link href={`/lessons/${l.next.id}`} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
                  <span>
                    {lessonKindLabel[l.next.kind]}: {formatDay(l.next.startsAt)}, {formatTime(l.next.startsAt)}
                    <span className="block text-xs text-slate-500">
                      {l.next.online ? "онлайн" : [l.next.room, l.next.building?.title].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            )}
            {l.deadlines.map((d) => (
              <li key={d.id}>
                <Link href={`/courses/${l.offeringId}`} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
                  <span>
                    {d.title}
                    <span className="block text-xs text-slate-500">
                      до {formatDate(d.at)}
                      {d.maxPoints ? ` · до ${d.maxPoints} баллов` : ""}
                    </span>
                  </span>
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {l.changes.length > 0 && (
        <details className="rounded-2xl bg-white px-4 py-1 shadow-sm ring-1 ring-black/5">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
            История изменений ({l.changes.length})
          </summary>
          <ul className="divide-y divide-slate-100">
            {l.changes.map((c) => (
              <ChangeLine key={c.id} c={c} titles={l.buildingTitles} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
