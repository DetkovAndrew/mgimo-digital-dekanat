import Link from "next/link";
import { ViewTransition } from "react";
import { formatDateTime, formatTime, lessonKindLabel } from "@/lib/format";
import type { ScheduleLesson } from "@/server/dal/schedule";
import { lessonTitleName } from "@/lib/view-transitions";
import { KindTime, kindStyle } from "./kind";
import { Chevron } from "./pending";
import { Badge } from "./ui";

/** Коротко, что поменялось: подробности и причина — на странице пары. */
export function changeSummary(lesson: Pick<ScheduleLesson, "status" | "startsAt" | "room" | "building" | "change">) {
  const ch = lesson.change;
  if (!ch || lesson.status !== "RESCHEDULED") return null;
  const parts = [];
  if (ch.previousStartsAt.getTime() !== lesson.startsAt.getTime()) parts.push(`было ${formatDateTime(ch.previousStartsAt)}`);
  if (ch.previousBuildingId !== (lesson.building?.id ?? null)) parts.push("другой корпус");
  else if (ch.previousRoom !== lesson.room) parts.push("другая аудитория");
  return parts.join(", ") || null;
}

export function LessonCard({ lesson }: { lesson: ScheduleLesson }) {
  const cancelled = lesson.status === "CANCELLED";
  const moved = lesson.status === "RESCHEDULED";
  const summary = changeSummary(lesson);
  const place = lesson.online ? "Онлайн" : [lesson.room, lesson.building?.title].filter(Boolean).join(" · ");

  return (
    <Link
      href={lesson.href}
      transitionTypes={["nav-forward"]}
      className={`group flex items-center gap-3 rounded-2xl bg-surface p-2.5 pr-3.5 ring-1 transition active:scale-[0.99] md:hover:ring-brand/30 ${
        cancelled ? "opacity-70 ring-bad/30" : moved ? "ring-warn/40" : "ring-hairline"
      }`}
    >
      <KindTime kind={lesson.kind} start={formatTime(lesson.startsAt)} end={formatTime(lesson.endsAt)} struck={cancelled} />
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 flex flex-wrap items-center gap-1.5">
          <span className={`text-xs font-semibold ${kindStyle(lesson.kind).text}`}>{lessonKindLabel[lesson.kind]}</span>
          {cancelled && <Badge tone="bad">Отменено</Badge>}
          {moved && <Badge tone="warn">Изменено</Badge>}
        </span>
        {lesson.source === "lesson" ? (
          <ViewTransition name={lessonTitleName(lesson.id)} share="morph" default="none">
            <span className={`block w-fit leading-snug font-semibold ${cancelled ? "line-through" : ""}`}>{lesson.title}</span>
          </ViewTransition>
        ) : (
          <span className="block leading-snug font-semibold">{lesson.title}</span>
        )}
        <span className="block truncate text-sm text-ink-2">
          {place}
          {lesson.teacher && ` · ${lesson.teacher}`}
        </span>
        {summary && <span className="mt-1 block text-xs text-warn">{summary}</span>}
      </span>
      <Chevron />
    </Link>
  );
}
