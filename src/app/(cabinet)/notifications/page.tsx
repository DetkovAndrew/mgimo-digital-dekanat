import { CalendarClock, ChevronRight, ClipboardCheck, FileText, Megaphone } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Empty, IconTile, List, PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { listMyNotifications, markAllMyNotificationsRead } from "@/server/dal/notifications";

const KIND = {
  ANNOUNCEMENT: { label: "Объявление", icon: Megaphone, tone: "brand" },
  SCHEDULE_CHANGE: { label: "Расписание", icon: CalendarClock, tone: "warn" },
  DEADLINE: { label: "Срок", icon: ClipboardCheck, tone: "info" },
  REQUEST_STATUS: { label: "Заявка", icon: FileText, tone: "ok" },
} as const;

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
              <button className="min-h-11 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-brand transition hover:bg-brand-soft active:scale-95">
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
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <IconTile icon={KIND[n.kind as keyof typeof KIND].icon} tone={n.important ? "warn" : KIND[n.kind as keyof typeof KIND].tone} />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                    {!n.readAt && (
                      <>
                        <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand-fill" />
                        <span className="sr-only">Новое.</span>
                      </>
                    )}
                    {KIND[n.kind as keyof typeof KIND].label} · {formatDateTime(n.publishedAt)}
                  </div>
                  <h2 className={`leading-snug ${n.readAt ? "font-medium" : "font-semibold"}`}>{n.title}</h2>
                  <p className="mt-0.5 text-sm text-ink-2">{n.body}</p>
                  {link && (
                    <Link href={link} transitionTypes={["nav-forward"]} className="mt-1 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-brand">
                      {n.requestId ? "Открыть заявку" : "К расписанию"}
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  )}
                </div>
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
