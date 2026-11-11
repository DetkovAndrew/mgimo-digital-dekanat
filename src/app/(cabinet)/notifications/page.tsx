import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Badge, Empty, List, PageTitle } from "@/components/ui";
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
        sub={unread ? `Новых: ${unread}` : "Всё прочитано"}
        aside={
          unread > 0 && (
            <form action={markAll}>
              <button className="min-h-11 rounded-xl px-3 text-sm font-medium text-brand transition hover:bg-brand-soft active:scale-95">
                Прочитать все
              </button>
            </form>
          )
        }
      >
        Уведомления
      </PageTitle>
      {items.length ? (
        <List>
          {items.map((n) => {
            const link = n.requestId ? `/requests/${n.requestId}` : n.kind === "SCHEDULE_CHANGE" ? "/schedule" : null;
            return (
              <li key={n.id} className="relative px-4 py-3">
                {!n.readAt && <span aria-label="Новое" className="absolute top-[18px] left-1.5 size-2 rounded-full bg-brand-fill" />}
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                  <Badge tone={n.important ? "warn" : "neutral"}>{kindLabel[n.kind]}</Badge>
                  {formatDateTime(n.publishedAt)}
                </div>
                <h2 className={`leading-snug ${n.readAt ? "font-medium" : "font-semibold"}`}>{n.title}</h2>
                <p className="mt-0.5 text-sm text-ink-2">{n.body}</p>
                {link && (
                  <Link href={link} transitionTypes={["nav-forward"]} className="mt-1 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-brand">
                    {n.requestId ? "Открыть заявку" : "К расписанию"}
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                )}
              </li>
            );
          })}
        </List>
      ) : (
        <Empty>Уведомлений пока нет.</Empty>
      )}
    </>
  );
}
