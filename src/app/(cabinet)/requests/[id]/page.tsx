import { BackLink } from "@/components/back-link";
import { Badge, Card, PageTitle } from "@/components/ui";
import { formatDateTime, requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog, type RequestTypeSpec } from "@/lib/requests/catalog";
import { getMyRequest } from "@/server/dal/requests";
import { cancelRequest } from "../actions";
import { AnswerForm } from "./answer-form";

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
        <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Заявка отправлена. Статус будет обновляться здесь и в уведомлениях.
        </p>
      )}
      <PageTitle aside={<Badge tone={status.tone}>{status.label}</Badge>}>{spec?.title ?? r.type}</PageTitle>
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        {formatRequestNumber(r.number)} · подана {formatDateTime(r.createdAt)}
      </p>

      {r.status === "NEEDS_INFO" && (
        <Card className="mb-4 ring-amber-300">
          <h2 className="mb-1 font-semibold">Деканат просит уточнить</h2>
          <p className="mb-3 text-sm text-slate-600">{r.events.findLast((e) => e.toStatus === "NEEDS_INFO")?.comment}</p>
          <AnswerForm id={r.id} />
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Данные заявки</h2>
        <dl className="divide-y divide-slate-100 text-sm">
          {Object.entries(payload).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2">
              <dt className="text-slate-500">{spec?.fields.find((f) => f.name === k)?.label ?? k}</dt>
              <dd className="break-words">{valueLabel(k, v)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">История</h2>
        <ol className="relative space-y-4 border-l border-slate-200 pl-4">
          {r.events.map((e) => (
            <li key={e.id}>
              <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-brand" aria-hidden />
              <p className="text-sm font-medium">{requestStatusLabel[e.toStatus].label}</p>
              <p className="text-xs text-slate-500">
                {formatDateTime(e.createdAt)} · {actorLabel[e.actorType]}
              </p>
              {e.comment && <p className="mt-1 text-sm text-slate-600">{e.comment}</p>}
            </li>
          ))}
        </ol>
      </Card>

      {["SUBMITTED", "IN_PROGRESS", "NEEDS_INFO"].includes(r.status) && (
        <form action={cancelRequest.bind(null, r.id)} className="mt-4">
          <button className="w-full rounded-xl bg-white px-4 py-3 text-sm text-red-600 ring-1 ring-black/5 hover:bg-red-50">
            Отозвать заявку
          </button>
        </form>
      )}
    </>
  );
}
