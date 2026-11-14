import { FileText } from "lucide-react";
import Link from "next/link";
import { ThemePicker } from "@/components/theme-picker";
import { Badge, Empty, List, PageTitle, RowLink, Section } from "@/components/ui";
import { formatDateTime, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { staffFilters } from "@/lib/staff/requests";
import { listFacultyRequests } from "@/server/dal/staff";
import { requireStaff } from "@/server/session";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  await requireStaff();
  const filter = (await searchParams).status ?? "SUBMITTED";
  const requests = await listFacultyRequests(filter);
  return (
    <>
      <PageTitle sub="Заявки студентов вашего факультета. Сначала — старые необработанные.">Заявки факультета</PageTitle>
      <nav aria-label="Статус заявок" className="mb-5 flex flex-wrap gap-2">
        {staffFilters.map((f) => (
          <Link key={f.value} href={`/staff?status=${f.value}`} transitionTypes={["nav-tab"]} aria-current={filter === f.value ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-xl px-3 text-body font-medium ${filter === f.value ? "bg-brand-fill text-on-brand" : "bg-surface text-ink-2 ring-1 ring-hairline"}`}>
            {f.label}
          </Link>
        ))}
      </nav>
      {requests.length ? (
        <List>
          {requests.map((r) => {
            const status = requestStatusLabel[r.status];
            return (
              <RowLink key={r.id} href={`/staff/requests/${r.id}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 text-body font-semibold"><FileText aria-hidden className="size-4 text-brand" />{formatRequestNumber(r.number)}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="mt-1 text-lead font-medium break-words">{isRequestType(r.type) ? requestCatalog[r.type].title : "Заявка"}</p>
                <p className="text-body break-words">{r.student.user.name} · {r.student.group.code}</p>
                <p className="mt-1 text-body text-ink-2">Подана {formatDateTime(r.createdAt)}</p>
              </RowLink>
            );
          })}
        </List>
      ) : <Empty>В этой очереди пока нет заявок.</Empty>}
      <Section title="Оформление" className="mt-10">
        <ThemePicker />
      </Section>
    </>
  );
}
