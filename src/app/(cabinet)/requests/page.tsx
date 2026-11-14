import { DoorOpen, Plus } from "lucide-react";
import Link from "next/link";
import { requestGroup } from "@/components/request-groups";
import { Badge, Disclosure, Empty, IconTile, List, PageTitle, RowLink, Section } from "@/components/ui";
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
    const c = requestGroup(isRequestType(r.type) ? requestCatalog[r.type].category : "question");
    return (
      <RowLink key={r.id} href={`/requests/${r.id}`}>
        <span className="flex items-center gap-3">
          <IconTile icon={c.icon} tone={c.tone} />
          <span className="min-w-0 flex-1">
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
      <div className="mb-7">
        <List>
          <RowLink href="/rooms">
            <span className="flex items-center gap-3">
              <IconTile icon={DoorOpen} tone="ok" />
              <span className="min-w-0">
                <span className="block font-medium">Забронировать аудиторию</span>
                <span className="block text-xs text-ink-2">Коворкинги и переговорные: схема корпуса и свободное время</span>
              </span>
            </span>
          </RowLink>
        </List>
      </div>
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
