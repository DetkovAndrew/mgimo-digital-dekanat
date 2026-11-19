import Link from "next/link";
import { KindTime } from "@/components/kind";
import { Badge, Empty, List, PageTitle, RowLink, Section } from "@/components/ui";
import { formatDay, formatTime, lessonKindLabel, mskDayKey } from "@/lib/format";
import { listFacultyLessons } from "@/server/dal/staff-schedule";
import { requireStaff } from "@/server/session";

// Пары факультета на две недели: выбрать пару и перенести или отменить её (карточка /staff/schedule/[id]).

export default async function StaffSchedulePage({ searchParams }: { searchParams: Promise<{ group?: string | string[] }> }) {
  await requireStaff();
  const raw = (await searchParams).group;
  const group = typeof raw === "string" && /^[\p{L}\d-]{1,16}$/u.test(raw) ? raw : undefined;
  const { groups, lessons, changed } = await listFacultyLessons({ group });
  const days = Map.groupBy(lessons, (l) => mskDayKey(l.startsAt));

  return (
    <>
      <PageTitle sub="Пары групп вашего факультета на две недели. Перенос или отмена сразу видны студентам: расписание, уведомление, путь до аудитории.">
        Расписание факультета
      </PageTitle>
      <nav aria-label="Группа" className="mb-5 flex flex-wrap gap-2">
        {[{ code: undefined as string | undefined, label: "Все группы" }, ...groups.map((g) => ({ code: g.code as string | undefined, label: g.code }))].map((g) => (
          <Link
            key={g.label}
            href={g.code ? `/staff/schedule?group=${encodeURIComponent(g.code)}` : "/staff/schedule"}
            aria-current={group === g.code ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-xl px-3 text-body font-medium ${group === g.code ? "bg-brand-soft font-semibold text-brand ring-2 ring-brand ring-inset" : "bg-surface text-ink-2 ring-1 ring-hairline"}`}
          >
            {g.label}
          </Link>
        ))}
      </nav>
      {changed.length > 0 && (
        <Section title="Изменено деканатом">
          <p className="mb-2 text-body text-ink-2">Аккаунт общий: в карточке пары можно вернуть время и место, какими они были.</p>
          <List>
            {changed.map((l) => (
              <LessonRow key={l.id} l={l} withDay />
            ))}
          </List>
        </Section>
      )}
      {lessons.length ? (
        [...days].map(([key, list]) => (
          <Section key={key} title={formatDay(list[0].startsAt)}>
            <List>
              {list.map((l) => (
                <LessonRow key={l.id} l={l} />
              ))}
            </List>
          </Section>
        ))
      ) : (
        <Empty>{group ? `У группы ${group} в ближайшие две недели пар нет.` : "В ближайшие две недели пар нет."}</Empty>
      )}
    </>
  );
}

type Lesson = Awaited<ReturnType<typeof listFacultyLessons>>["lessons"][number];

function LessonRow({ l, withDay = false }: { l: Lesson; withDay?: boolean }) {
  return (
    <RowLink href={`/staff/schedule/${l.id}`}>
      <span className="flex items-center gap-3">
        <KindTime kind={l.kind} start={formatTime(l.startsAt)} end={formatTime(l.endsAt)} struck={l.status === "CANCELLED"} />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{l.offering.discipline.title}</span>
            {l.status === "CANCELLED" && <Badge tone="bad">Отменено</Badge>}
            {l.status === "RESCHEDULED" && <Badge tone="warn">Изменено</Badge>}
          </span>
          <span className="block text-sm text-ink-2">
            {withDay && <>{formatDay(l.startsAt)} · </>}{lessonKindLabel[l.kind]} · {l.offering.group.code} · {l.online ? "онлайн" : [l.room, l.building?.title].filter(Boolean).join(", ") || "место не указано"}
          </span>
        </span>
      </span>
    </RowLink>
  );
}
