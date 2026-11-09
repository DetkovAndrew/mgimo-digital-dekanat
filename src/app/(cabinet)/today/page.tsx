import Link from "next/link";
import { LessonCard } from "@/components/lesson-card";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { addDays, formatDateTime, formatDay, mskStartOfDay, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { listMyNotifications } from "@/server/dal/notifications";
import { getMyProfile } from "@/server/dal/profile";
import { listMyRequests } from "@/server/dal/requests";
import { getMySchedule } from "@/server/dal/schedule";

export default async function TodayPage() {
  const now = new Date();
  const today = mskStartOfDay(now);
  const [profile, lessons, notifications, requests] = await Promise.all([
    getMyProfile(),
    getMySchedule({ from: today, to: addDays(today, 1) }),
    listMyNotifications({ unreadOnly: true, take: 5 }),
    listMyRequests(),
  ]);
  const active = requests.filter((r) => !["DONE", "CANCELLED", "REJECTED"].includes(r.status));
  const firstName = profile.fullName.split(" ")[1] ?? profile.fullName;

  return (
    <>
      <PageTitle>Привет, {firstName}!</PageTitle>
      <p className="-mt-3 mb-5 text-sm text-slate-500 first-letter:uppercase">{formatDay(now)}</p>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Пары сегодня</h2>
        {lessons.length ? (
          <div className="space-y-2">
            {lessons.map((l) => (
              <LessonCard key={l.id} lesson={l} />
            ))}
          </div>
        ) : (
          <Empty>
            Сегодня пар нет.{" "}
            <Link className="text-brand" href="/schedule">
              Открыть неделю
            </Link>
          </Empty>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Новое</h2>
            <Link href="/notifications" className="text-sm text-brand">
              Все
            </Link>
          </div>
          {notifications.length ? (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li key={n.id} className="py-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(n.publishedAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Непрочитанных уведомлений нет.</p>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Мои заявки</h2>
            <Link href="/requests/new" className="text-sm text-brand">
              + Новая
            </Link>
          </div>
          {active.length ? (
            <ul className="divide-y divide-slate-100">
              {active.map((r) => (
                <li key={r.id}>
                  <Link href={`/requests/${r.id}`} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-sm">
                      {isRequestType(r.type) ? requestCatalog[r.type].title : r.type}
                      <span className="block text-xs text-slate-500">{formatRequestNumber(r.number)}</span>
                    </span>
                    <Badge tone={requestStatusLabel[r.status].tone}>{requestStatusLabel[r.status].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Активных заявок нет.</p>
          )}
        </Card>
      </div>
    </>
  );
}
