import Link from "next/link";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { formatDateTime, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { listMyRequests } from "@/server/dal/requests";

export default async function RequestsPage() {
  const requests = await listMyRequests();
  return (
    <>
      <PageTitle
        aside={
          <Link href="/requests/new" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
            + Новая заявка
          </Link>
        }
      >
        Заявки
      </PageTitle>
      {requests.length ? (
        <ul className="space-y-2">
          {requests.map((r) => {
            const s = requestStatusLabel[r.status];
            return (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 hover:ring-brand/40"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{isRequestType(r.type) ? requestCatalog[r.type].title : r.type}</span>
                    <span className="text-xs text-slate-500">
                      {formatRequestNumber(r.number)} · обновлена {formatDateTime(r.updatedAt)}
                    </span>
                  </span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>Заявок пока нет. Справку или заявление можно подать онлайн — без очереди в деканате.</Empty>
      )}
    </>
  );
}
