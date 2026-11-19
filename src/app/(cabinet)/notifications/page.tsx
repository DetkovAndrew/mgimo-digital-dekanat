import { revalidatePath } from "next/cache";
import { PageTitle } from "@/components/ui";
import { formatDateTime, mskDayKey } from "@/lib/format";
import { listMyNotifications, markAllMyNotificationsRead } from "@/server/dal/notifications";
import { requireStudent } from "@/server/session";
import { NotificationList } from "./notification-list";

const LIMIT = 100;

/** «К расписанию» — на неделю, где сейчас стоит пара: перенос на следующую неделю иначе не виден на текущей.
 * Дата, а не номер недели: неделю считает расписание при открытии (ревью Codex 95). */
const scheduleHref = (lessonAt: Date | undefined) => (lessonAt ? `/schedule?view=week&on=${mskDayKey(lessonAt)}` : "/schedule");

async function markAll() {
  "use server";
  await markAllMyNotificationsRead();
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const [{ userId }, items] = await Promise.all([requireStudent(), listMyNotifications({ take: LIMIT })]);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageTitle
        sub={unread ? `Новых: ${unread}` : "Всё прочитано"}
        aside={
          unread > 0 && (
            <form action={markAll}>
              <button className="min-h-11 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-brand transition hover:bg-brand-soft active:scale-95">
                Отметить всё как прочитанное
              </button>
            </form>
          )
        }
      >
        Уведомления
      </PageTitle>
      {/* key: при смене аккаунта выбор и скрытые строки прежнего не переносятся. */}
      <NotificationList
        key={userId}
        owner={userId}
        items={items.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          important: n.important,
          when: formatDateTime(n.publishedAt),
          at: n.publishedAt.getTime(),
          read: Boolean(n.readAt),
          link: n.requestId ? { href: `/requests/${n.requestId}`, label: "Открыть заявку" } : n.kind === "SCHEDULE_CHANGE" ? { href: scheduleHref(n.lesson?.startsAt), label: "К расписанию" } : null,
        }))}
      />
    </>
  );
}
