import { BackLink } from "@/components/back-link";
import { Badge, Empty, List, PageTitle, Row, RowLink, Section } from "@/components/ui";
import { formatDay, formatTime, lessonKindLabel, mskDayKey } from "@/lib/format";
import { getTeacher, TEACHER_SCHEDULE_DAYS, type TeacherProfile } from "@/server/dal/teachers";

function Body({ l }: { l: TeacherProfile["schedule"][number] }) {
  return (
    <span className={`flex items-start gap-3 ${l.status === "CANCELLED" ? "line-through opacity-60" : ""}`}>
      <span className="w-11 shrink-0 pt-px text-sm font-semibold tabular-nums">{formatTime(l.startsAt)}</span>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-medium">{l.title}</span>
        <span className="block text-xs text-slate-500">
          {lessonKindLabel[l.kind]} · {l.group} · {l.online ? "онлайн" : [l.room, l.building?.title].filter(Boolean).join(", ")}
        </span>
      </span>
      {l.mine && <Badge tone="info">ваша</Badge>}
    </span>
  );
}

export default async function TeacherPage({ params }: PageProps<"/teachers/[id]">) {
  const { id } = await params;
  const t = await getTeacher(id);
  const days = Map.groupBy(t.schedule, (l) => mskDayKey(l.startsAt));

  return (
    <>
      <BackLink href="/schedule">Расписание</BackLink>
      <PageTitle sub={t.position}>{t.fullName}</PageTitle>

      {t.myCourses.length > 0 && (
        <Section title="Ведёт у вас">
          <List>
            {t.myCourses.map((c) => (
              <RowLink key={c.id} href={`/courses/${c.id}`}>
                <span className="block font-medium">{c.title}</span>
                {!c.lead && <span className="block text-sm text-slate-500">часть занятий</span>}
              </RowLink>
            ))}
          </List>
        </Section>
      )}

      {days.size ? (
        [...days].map(([key, items]) => (
          <Section key={key} title={formatDay(items[0].startsAt)}>
            <List>
              {items.map((l, i) =>
                l.lessonId ? (
                  <RowLink key={i} href={`/lessons/${l.lessonId}`}>
                    <Body l={l} />
                  </RowLink>
                ) : (
                  <Row key={i}>
                    <span className="min-w-0 flex-1">
                      <Body l={l} />
                    </span>
                  </Row>
                ),
              )}
            </List>
          </Section>
        ))
      ) : (
        <Empty>В ближайшие {TEACHER_SCHEDULE_DAYS} дней занятий нет.</Empty>
      )}
      <p className="px-1 text-xs text-slate-400">
        Расписание преподавателей открыто всем студентам University на {TEACHER_SCHEDULE_DAYS} дней вперёд. Оценки и списки студентов
        здесь не показываются.
      </p>
    </>
  );
}
