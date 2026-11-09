import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { listMyNotifications, markAllMyNotificationsRead } from "@/server/dal/notifications";

const kindLabel: Record<string, string> = {
  ANNOUNCEMENT: "Объявление",
  SCHEDULE_CHANGE: "Расписание",
  DEADLINE: "Дедлайн",
  REQUEST_STATUS: "Заявка",
};

async function markAll() {
  "use server";
  await markAllMyNotificationsRead();
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const items = await listMyNotifications();
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageTitle
        aside={
          unread > 0 && (
            <form action={markAll}>
              <button className="rounded-lg px-3 py-2 text-sm text-brand hover:bg-brand/10">Прочитать все</button>
            </form>
          )
        }
      >
        Уведомления
      </PageTitle>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl bg-white p-3 shadow-sm ring-1 ${n.readAt ? "ring-black/5" : "ring-brand/40"}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                {!n.readAt && <span className="size-2 rounded-full bg-brand" aria-label="Новое" />}
                <Badge tone={n.important ? "warn" : "neutral"}>{kindLabel[n.kind]}</Badge>
                {formatDateTime(n.publishedAt)}
              </div>
              <h2 className="font-medium">{n.title}</h2>
              <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
              {n.requestId && (
                <Link href={`/requests/${n.requestId}`} className="mt-1 inline-block text-sm text-brand">
                  Открыть заявку →
                </Link>
              )}
              {n.kind === "SCHEDULE_CHANGE" && (
                <Link href="/schedule" className="mt-1 inline-block text-sm text-brand">
                  К расписанию →
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Уведомлений пока нет.</Empty>
      )}
    </>
  );
}
