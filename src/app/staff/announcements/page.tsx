import { Megaphone } from "lucide-react";
import { Badge, Card, Empty, PageTitle, Section } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getFacultyAnnouncements } from "@/server/dal/staff-announcements";
import { requireStaff } from "@/server/session";
import { AnnouncementForm } from "./announcement-form";

// Объявления деканата студентам своего факультета: всем, курсу или группе. Приходят в «Уведомления» студента.

export default async function StaffAnnouncementsPage() {
  await requireStaff();
  const { groups, courses, recent } = await getFacultyAnnouncements();
  return (
    <>
      <PageTitle sub="Объявление придёт студентам в «Уведомления»: всему факультету, одному курсу или одной группе.">Объявления</PageTitle>
      <Section title="Новое объявление">
        <Card>
          <AnnouncementForm groups={groups.map((g) => g.code)} courses={courses} />
        </Card>
      </Section>
      <Section title="Последние объявления факультета">
        {recent.length ? (
          <ul className="space-y-2">
            {recent.map((n) => (
              <li key={n.id} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-hairline">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <Megaphone aria-hidden className="size-4 text-brand" />
                  <span className="min-w-0 break-words">{n.title}</span>
                  {n.important && <Badge tone="warn">Важное</Badge>}
                </p>
                <p className="mt-1 text-body break-words whitespace-pre-line">{n.body}</p>
                <p className="mt-1 text-sm text-ink-2">
                  {formatDateTime(n.publishedAt)} · получателей: {n._count.recipients}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Объявлений пока не было.</Empty>
        )}
      </Section>
    </>
  );
}
