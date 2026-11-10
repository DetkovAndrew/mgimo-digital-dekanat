import { yandexRouteUrl } from "@/lib/geo";
import { formatDateTime, formatTime, lessonKindLabel } from "@/lib/format";
import type { ScheduleLesson } from "@/server/dal/schedule";
import { Badge } from "./ui";

export function LessonCard({ lesson }: { lesson: ScheduleLesson }) {
  const cancelled = lesson.status === "CANCELLED";
  const moved = lesson.status === "RESCHEDULED";
  const ch = lesson.change;

  return (
    <article
      className={`flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ${
        cancelled ? "opacity-70 ring-red-200" : moved ? "ring-amber-300" : "ring-black/5"
      }`}
    >
      <div className="w-14 shrink-0 text-center">
        <p className={`text-sm font-semibold ${cancelled ? "line-through" : ""}`}>{formatTime(lesson.startsAt)}</p>
        <p className="text-xs text-slate-500">{formatTime(lesson.endsAt)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">{lessonKindLabel[lesson.kind]}</span>
          {cancelled && <Badge tone="bad">Отменено</Badge>}
          {moved && <Badge tone="warn">Изменено</Badge>}
        </div>
        <h3 className={`font-medium leading-snug ${cancelled ? "line-through" : ""}`}>{lesson.title}</h3>
        <p className="mt-0.5 text-sm text-slate-600">
          {lesson.online ? (
            <Badge tone="info">Онлайн</Badge>
          ) : (
            [lesson.room, lesson.building?.title].filter(Boolean).join(" · ")
          )}
        </p>
        <p className="text-sm text-slate-500">{lesson.teacher}</p>
        {ch && (moved || cancelled) && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            {moved && (ch.previousStartsAt.getTime() !== lesson.startsAt.getTime() || ch.previousRoom !== lesson.room) && (
              <>
                Было: {formatDateTime(ch.previousStartsAt)}
                {ch.previousRoom ? `, ${ch.previousRoom}` : ""}.{" "}
              </>
            )}
            {ch.reason}
          </p>
        )}
        {lesson.building && !cancelled && (
          <a
            href={yandexRouteUrl(lesson.building, "mt")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand"
          >
            Маршрут в Яндекс Картах →
            {lesson.building.metro && <span className="font-normal text-slate-500">м. {lesson.building.metro}</span>}
          </a>
        )}
      </div>
    </article>
  );
}
