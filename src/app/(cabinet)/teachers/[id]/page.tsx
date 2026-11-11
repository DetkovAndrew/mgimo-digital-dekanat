import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Card, Empty } from "@/components/ui";
import { formatDay, formatTime, lessonKindLabel, mskDayKey } from "@/lib/format";
import { getTeacher, TEACHER_SCHEDULE_DAYS, type TeacherProfile } from "@/server/dal/teachers";

type Item = TeacherProfile["schedule"][number];

function Row({ l }: { l: Item }) {
  const cancelled = l.status === "CANCELLED";
  const body = (
    <>
      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatTime(l.startsAt)}</span>
      <span className={`min-w-0 flex-1 text-sm ${cancelled ? "line-through opacity-70" : ""}`}>
        <span className="block font-medium leading-snug">{l.title}</span>
        <span className="block text-xs text-slate-500">
          {lessonKindLabel[l.kind]} · {l.group} · {l.online ? "онлайн" : [l.room, l.building?.title].filter(Boolean).join(", ")}
        </span>
      </span>
    </>
  );
  return l.lessonId ? (
    <Link href={`/lessons/${l.lessonId}`} className="flex min-h-11 items-center gap-3 rounded-xl bg-brand/5 px-2 py-2 ring-1 ring-brand/20">
      {body}
      <span className="shrink-0 text-xs font-medium text-brand">ваша группа ›</span>
    </Link>
  ) : (
    <div className="flex min-h-11 items-center gap-3 px-2 py-2">{body}</div>
  );
}

export default async function TeacherPage({ params }: PageProps<"/teachers/[id]">) {
  const { id } = await params;
  const t = await getTeacher(id);
  const days = Map.groupBy(t.schedule, (l) => mskDayKey(l.startsAt));

  return (
    <>
      <BackLink href="/schedule">Расписание</BackLink>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{t.fullName}</h1>
      {t.position && <p className="mt-1 text-sm text-slate-500">{t.position}</p>}

      {t.myCourses.length > 0 && (
        <Card className="mt-4 !py-2">
          <h2 className="pt-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Ведёт у вас</h2>
          <ul className="divide-y divide-slate-100">
            {t.myCourses.map((c) => (
              <li key={c.id}>
                <Link href={`/courses/${c.id}`} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
                  <span>
                    {c.title}
                    {!c.lead && <span className="block text-xs text-slate-500">часть занятий</span>}
                  </span>
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mt-6 mb-2 font-semibold">Расписание на {TEACHER_SCHEDULE_DAYS} дней</h2>
      {days.size ? (
        <div className="space-y-4">
          {[...days].map(([key, items]) => (
            <section key={key}>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{formatDay(items[0].startsAt)}</h3>
              <div className="space-y-1">
                {items.map((l, i) => (
                  <Row key={i} l={l} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty>В ближайшие дни занятий нет.</Empty>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Расписание преподавателей открыто всем студентам University. Оценки и списки студентов здесь не показываются.
      </p>
    </>
  );
}
