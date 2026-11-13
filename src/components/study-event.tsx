import { CalendarClock, ChevronRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { formatTime } from "@/lib/format";
import type { StudyEvent } from "@/server/dal/grades";

const KIND: Record<string, string> = {
  EXAM: "Экзамен",
  CREDIT: "Зачёт",
  GRADED_CREDIT: "Зачёт с оценкой",
  MIDTERM: "Контрольная",
  ASSIGNMENT: "Срок сдачи",
};

/** Экзамен, зачёт или срок работы в расписании и календаре: ведёт на страницу дисциплины. */
export function StudyEventRow({ event }: { event: StudyEvent }) {
  const exam = event.kind === "EXAM" || event.kind === "CREDIT" || event.kind === "GRADED_CREDIT";
  const Icon = exam ? GraduationCap : CalendarClock;
  return (
    <Link
      href={`/courses/${event.offeringId}`}
      transitionTypes={["nav-forward"]}
      className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 transition active:scale-[0.99] ${exam ? "bg-bad-soft ring-bad/25" : "bg-surface ring-hairline"}`}
    >
      <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl ${exam ? "bg-surface text-bad" : "bg-warn-soft text-warn"}`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-semibold ${exam ? "text-bad" : "text-warn"}`}>
          {KIND[event.kind] ?? "Работа"}
          {event.result && ` · ${{ passed: "сдано", failed: "не сдано", checked: "проверено" }[event.result]}`}
        </span>
        <span className="block font-medium">{event.discipline}</span>
        <span className="block text-sm text-ink-2">
          {event.deadline ? `${event.title}, до ${formatTime(event.at)}` : `${formatTime(event.at)}${event.room ? `, ${event.room}` : ""}`}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
    </Link>
  );
}
