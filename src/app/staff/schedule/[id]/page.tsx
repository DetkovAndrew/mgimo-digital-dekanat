import { BackLink } from "@/components/back-link";
import { Badge, Card, PageTitle, Section } from "@/components/ui";
import { roomNumberFrom } from "@/lib/campus/plans";
import { formatDateTime, formatDay, formatTime, lessonKindLabel, mskDayKey } from "@/lib/format";
import { getFacultyLesson } from "@/server/dal/staff-schedule";
import { requireStaff } from "@/server/session";
import { RescheduleForm } from "./reschedule-form";

const statusLabel = { SCHEDULED: null, RESCHEDULED: { tone: "warn", text: "Изменено" }, CANCELLED: { tone: "bad", text: "Отменено" } } as const;

export default async function StaffLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string | string[] }> }) {
  await requireStaff();
  const { id } = await params;
  const { lesson: l, version, buildings } = await getFacultyLesson(id);
  const { updated } = await searchParams;
  const status = statusLabel[l.status];
  const past = l.endsAt <= new Date();

  return (
    <>
      <BackLink href="/staff/schedule">Расписание факультета</BackLink>
      <PageTitle aside={status && <Badge tone={status.tone}>{status.text}</Badge>} sub={`${lessonKindLabel[l.kind]} · группа ${l.offering.group.code}, ${l.offering.group.course} курс`}>
        {l.offering.discipline.title}
      </PageTitle>
      {updated === "1" && <p role="status" className="mb-5 rounded-xl bg-ok-soft px-3 py-2 text-body text-ok">Сохранено. Студенты группы получили уведомление и видят изменение в расписании.</p>}
      <Section title="Сейчас">
        <Card>
          <p className="text-lead font-semibold first-letter:uppercase">
            {formatDay(l.startsAt)}, {formatTime(l.startsAt)}–{formatTime(l.endsAt)}
          </p>
          <p className="text-body text-ink-2">{l.online ? "Онлайн" : [l.room, l.building?.title].filter(Boolean).join(", ") || "Место не указано"}</p>
        </Card>
      </Section>
      <Section title="Перенести или отменить">
        <Card>
          {past ? (
            <p className="text-body text-ink-2">Пара уже прошла — её не изменить.</p>
          ) : l.status === "CANCELLED" ? (
            <p className="text-body text-ink-2">Пара отменена.</p>
          ) : (
            <RescheduleForm
              id={l.id}
              expected={version}
              defaults={{ date: mskDayKey(l.startsAt), start: formatTime(l.startsAt), end: formatTime(l.endsAt), building: l.online ? "" : (l.building?.id ?? ""), room: l.online ? "" : (roomNumberFrom(l.room) ?? "") }}
              buildings={buildings}
            />
          )}
        </Card>
      </Section>
      {l.changes.length > 0 && (
        <Section title="История изменений">
          <ul className="space-y-2">
            {l.changes.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface px-3 py-2 text-body ring-1 ring-hairline">
                <span className="font-medium">{c.newStatus === "CANCELLED" ? "Отмена" : "Перенос"}</span>
                <span className="text-ink-2"> · {formatDateTime(c.createdAt)}</span>
                {c.reason && <span className="block text-ink-2">Причина: {c.reason}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
