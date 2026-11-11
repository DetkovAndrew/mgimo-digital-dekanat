import Link from "next/link";
import { formatDateTime, formatTime, lessonKindLabel } from "@/lib/format";
import type { ScheduleLesson } from "@/server/dal/schedule";
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
      className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 transition hover:ring-brand/40 ${
        cancelled ? "opacity-70 ring-red-200" : moved ? "ring-amber-300" : "ring-black/5"
      }`}
    >
      <span className="w-12 shrink-0 text-center">
        <span className={`block text-sm font-semibold ${cancelled ? "line-through" : ""}`}>{formatTime(lesson.startsAt)}</span>
        <span className="block text-xs text-slate-500">{formatTime(lesson.endsAt)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">{lessonKindLabel[lesson.kind]}</span>
          {cancelled && <Badge tone="bad">Отменено</Badge>}
          {moved && <Badge tone="warn">Изменено</Badge>}
        </span>
        <span className={`block font-medium leading-snug ${cancelled ? "line-through" : ""}`}>{lesson.title}</span>
        <span className="block truncate text-sm text-slate-500">
          {place}
          {lesson.teacher && ` · ${lesson.teacher}`}
        </span>
        {summary && <span className="mt-1 block text-xs text-amber-800">{summary}</span>}
      </span>
      <span aria-hidden className="shrink-0 text-lg text-slate-300">
        ›
      </span>
    </Link>
  );
}
