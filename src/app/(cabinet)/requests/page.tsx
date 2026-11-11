import { Plus } from "lucide-react";
import Link from "next/link";
import { Badge, Disclosure, Empty, List, PageTitle, RowLink, Section } from "@/components/ui";
import { formatDateTime, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { listMyRequests } from "@/server/dal/requests";

const DONE = new Set(["DONE", "REJECTED", "CANCELLED"]);

export default async function RequestsPage() {
  const requests = await listMyRequests();
  const active = requests.filter((r) => !DONE.has(r.status));
  const done = requests.filter((r) => DONE.has(r.status));

  const row = (r: (typeof requests)[number]) => {
    const s = requestStatusLabel[r.status];
    return (
      <RowLink key={r.id} href={`/requests/${r.id}`}>
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-medium">{isRequestType(r.type) ? requestCatalog[r.type].title : r.type}</span>
            <span className="block text-xs text-ink-2">
              {formatRequestNumber(r.number)} · {formatDateTime(r.updatedAt)}
            </span>
          </span>
          <Badge tone={s.tone}>{s.label}</Badge>
        </span>
      </RowLink>
    );
  };

  return (
    <>
      <PageTitle
        aside={
          <Link
            href="/requests/new"
            transitionTypes={["nav-forward"]}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-fill px-4 text-sm font-semibold text-on-brand transition active:scale-95"
          >
            <Plus aria-hidden className="size-4" />
            Новая
          </Link>
        }
      >
        Заявки
      </PageTitle>
      {requests.length ? (
        <>
          {active.length > 0 && (
            <Section title="В работе">
              <List>{active.map(row)}</List>
            </Section>
          )}
          {done.length > 0 && (
            <Disclosure open={!active.length} title={`Завершённые (${done.length})`}>
              <List>{done.map(row)}</List>
            </Disclosure>
          )}
        </>
      ) : (
        <Empty>Заявок пока нет. Справку или заявление можно подать онлайн — без очереди в деканате.</Empty>
      )}
    </>
  );
}
