import Link from "next/link";
import { requestGroup } from "@/components/request-groups";
import { Badge, Disclosure, Empty, IconTile, List, PageTitle, RowLink, Section } from "@/components/ui";
import { formatDateTime, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { listMyRequests } from "@/server/dal/requests";
import { DONE, RequestTabs } from "../tabs";

// Вкладка «Мои заявки»: в работе и завершённые. Подать новую — вкладка «Заявки» (каталог).
export default async function MyRequestsPage() {
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
      <PageTitle sub="Статус обновляется здесь и в уведомлениях.">Заявки</PageTitle>
      <RequestTabs current="my" active={active.length} />
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
        <Empty art="requests">
          Заявок пока нет. Справку или заявление можно подать онлайн во вкладке{" "}
          <Link href="/requests" replace transitionTypes={["nav-tab"]} className="font-medium text-brand">
            «Заявки»
          </Link>
          , без очереди в деканате.
        </Empty>
      )}
    </>
  );
}
