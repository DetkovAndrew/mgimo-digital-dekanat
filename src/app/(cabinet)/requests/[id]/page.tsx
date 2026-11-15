import { Download, FileCheck2 } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge, Card, IconTile, PageTitle } from "@/components/ui";
import { formatDocumentNumber, issuesCertificate } from "@/lib/documents/certificate";
import { formatDate, formatDateTime, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog, type RequestTypeSpec } from "@/lib/requests/catalog";
import { verifyUrlFor } from "@/server/dal/documents";
import { getMyRequest } from "@/server/dal/requests";
import { cancelRequest } from "../actions";
import { AnswerForm } from "./answer-form";
import { CopyLink } from "./copy-link";

const actorLabel: Record<string, string> = { STUDENT: "Вы", STAFF: "Деканат", SYSTEM: "Система" };

export default async function RequestPage({ params, searchParams }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  const r = await getMyRequest(id);
  const spec: RequestTypeSpec | null = isRequestType(r.type) ? requestCatalog[r.type] : null;
  const status = requestStatusLabel[r.status];
  const payload = (r.payload ?? {}) as Record<string, unknown>;

  const valueLabel = (name: string, value: unknown) => {
    const field = spec?.fields.find((f) => f.name === name);
    const option = field?.options?.find((o) => o.value === value);
    return option?.label ?? String(value ?? "—");
  };

  return (
    <>
      <BackLink href="/requests">Заявки</BackLink>
      {created && (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">
          Заявка отправлена. Статус будет обновляться здесь и в уведомлениях.
        </p>
      )}
      <PageTitle aside={<Badge tone={status.tone}>{status.label}</Badge>}>{spec?.title ?? r.type}</PageTitle>
      <p className="-mt-2 mb-4 text-sm text-ink-2">
        {formatRequestNumber(r.number)} · подана {formatDateTime(r.createdAt)}
      </p>

      {r.status === "NEEDS_INFO" && (
        <Card className="mb-4 ring-warn/40">
          <h2 className="mb-1 font-semibold">Деканат просит уточнить</h2>
          <p className="mb-3 text-sm text-ink-2">{r.events.findLast((e) => e.toStatus === "NEEDS_INFO")?.comment}</p>
          <AnswerForm id={r.id} />
        </Card>
      )}

      {r.document ? (
        <Card className="mb-4">
          <div className="mb-4 flex items-center gap-3">
            <IconTile icon={FileCheck2} tone="ok" />
            <div className="min-w-0">
              <h2 className="font-semibold">Справка готова</h2>
              <p className="text-sm text-ink-2">
                {formatDocumentNumber(r.document.number)} от {formatDate(r.document.issuedAt)}
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={`/api/requests/${r.id}/document`}
              download
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-fill px-4 text-body font-semibold text-on-brand"
            >
              <Download aria-hidden className="size-5" />
              Скачать PDF
            </a>
            <CopyLink url={verifyUrlFor(r.document.verifyToken)} />
          </div>
          <p className="mt-3 text-sm text-ink-2">
            Работодатель проверит справку по QR-коду. Страницу проверки откроет любой, у кого есть ссылка: отправляйте её
            только тем, кому предоставляете справку. Документ демонстрационный.
          </p>
        </Card>
      ) : (
        issuesCertificate(r.type, r.payload) &&
        (r.status === "READY" || r.status === "DONE") && (
          <p className="mb-4 rounded-xl bg-fill px-3 py-2 text-sm text-ink-2">
            PDF для этой заявки не выпускался: она выполнена до появления электронных справок.
          </p>
        )
      )}

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Данные заявки</h2>
        <dl className="divide-y divide-hairline text-sm">
          {Object.entries(payload).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2">
              <dt className="text-ink-2">{spec?.fields.find((f) => f.name === k)?.label ?? k}</dt>
              <dd className="break-words">{valueLabel(k, v)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">История</h2>
        <ol className="relative space-y-4 border-l border-hairline pl-4">
          {r.events.map((e) => (
            <li key={e.id}>
              <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-brand-fill" aria-hidden />
              <p className="text-sm font-medium">{requestStatusLabel[e.toStatus].label}</p>
              <p className="text-xs text-ink-2">
                {formatDateTime(e.createdAt)} · {actorLabel[e.actorType]}
              </p>
              {e.comment && <p className="mt-1 text-sm text-ink-2">{e.comment}</p>}
            </li>
          ))}
        </ol>
      </Card>

      {["SUBMITTED", "IN_PROGRESS", "NEEDS_INFO"].includes(r.status) && (
        <form action={cancelRequest.bind(null, r.id)} className="mt-4">
          <button className="w-full rounded-xl bg-surface px-4 py-3 text-sm text-bad ring-1 ring-hairline hover:bg-bad-soft">
            Отозвать заявку
          </button>
        </form>
      )}
    </>
  );
}
