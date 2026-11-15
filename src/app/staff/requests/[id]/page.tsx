import { BackLink } from "@/components/back-link";
import { Badge, Card, PageTitle, Section } from "@/components/ui";
import { formatDocumentNumber, issuesCertificate } from "@/lib/documents/certificate";
import { formatDate, formatDateTime, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog, type RequestTypeSpec } from "@/lib/requests/catalog";
import { getFacultyRequest } from "@/server/dal/staff";
import { requireStaff } from "@/server/session";
import { RequestActions } from "./request-actions";

const actors: Record<string, string> = { STUDENT: "Студент", STAFF: "Деканат", SYSTEM: "Система" };

export default async function StaffRequestPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string | string[] }>;
}) {
  await requireStaff();
  const { id } = await params;
  const r = await getFacultyRequest(id);
  const { updated } = await searchParams;
  const spec: RequestTypeSpec | null = isRequestType(r.type) ? requestCatalog[r.type] : null;
  const payload = r.payload && typeof r.payload === "object" && !Array.isArray(r.payload) ? r.payload : {};
  const status = requestStatusLabel[r.status];
  return (
    <>
      <BackLink href="/staff">Заявки факультета</BackLink>
      <PageTitle aside={<Badge tone={status.tone}>{status.label}</Badge>} sub={`${formatRequestNumber(r.number)} · подана ${formatDateTime(r.createdAt)}`}>{spec?.title ?? "Заявка"}</PageTitle>
      {updated === r.status && <p role="status" className="mb-5 rounded-xl bg-ok-soft px-3 py-2 text-body text-ok">Статус сохранён. Студент получил уведомление.</p>}
      <Section title="Студент">
        <Card>
          <p className="text-lead font-semibold break-words">{r.student.user.name}</p>
          <p className="mt-1 text-body text-ink-2">{r.student.group.code} · {r.student.group.course} курс</p>
        </Card>
      </Section>
      <Section title="Данные заявки">
        <Card>
          <dl className="divide-y divide-hairline text-body">
            {spec ? spec.fields.map((field) => {
              const raw = payload[field.name];
              const value = field.options?.find((o) => o.value === raw)?.label ?? (raw === null || raw === undefined || raw === "" ? "Не указано" : String(raw));
              return <div key={field.name} className="py-2 first:pt-0 last:pb-0"><dt className="text-ink-2">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value}</dd></div>;
            }) : <div><dt className="text-ink-2">Тип заявки</dt><dd>Неизвестный тип. Проверьте данные с администратором.</dd></div>}
          </dl>
        </Card>
      </Section>
      {(r.document || (issuesCertificate(r.type, payload) && r.status === "IN_PROGRESS")) && (
        <Section title="Электронная справка">
          <Card>
            <p className="text-body">
              {r.document
                ? `Выпущена справка ${formatDocumentNumber(r.document.number)} от ${formatDate(r.document.issuedAt)}. Студент скачивает PDF в заявке.`
                : "При переводе в «Готово» выпускается PDF с QR-кодом проверки. Данные берутся из профиля студента на этот момент."}
            </p>
          </Card>
        </Section>
      )}
      <Section title="Обработка">
        <Card><RequestActions key={`${r.id}:${r.status}:${r.updatedAt.toISOString()}`} id={r.id} status={r.status} /></Card>
      </Section>
      <Section title="История">
        <Card>
          {r.events.length ? <ol className="space-y-4">
            {r.events.map((e) => <li key={e.id}>
              <p className="text-body font-semibold">{requestStatusLabel[e.toStatus].label}</p>
              <p className="text-body text-ink-2">{formatDateTime(e.createdAt)} · {actors[e.actorType]}</p>
              {e.comment && <p className="mt-1 whitespace-pre-wrap text-body break-words">{e.comment}</p>}
            </li>)}
          </ol> : <p className="text-body text-ink-2">История пока пуста.</p>}
        </Card>
      </Section>
    </>
  );
}
