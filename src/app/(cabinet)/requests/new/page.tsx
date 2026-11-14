import { BackLink } from "@/components/back-link";
import { Card, PageTitle } from "@/components/ui";
import { isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { prefillFor } from "@/lib/requests/prefill";
import { RequestForm } from "./request-form";
import { RequestPicker } from "./request-picker";

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const sp = await searchParams;
  const { type } = sp;

  if (typeof type === "string" && isRequestType(type)) {
    const spec = requestCatalog[type];
    // Поля из ссылки (например, от помощника); непроверяемая ссылка — пустая форма.
    const defaults = prefillFor(type, Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")) ?? {};
    const prefilled = Object.keys(defaults).length > 0;
    return (
      <>
        <BackLink href="/requests/new">Виды заявок</BackLink>
        <PageTitle sub={`${spec.description} Обычно готово за ${spec.slaDays} раб. дн. (демо-срок).`}>{spec.title}</PageTitle>
        <Card>
          {/* Описание полей сериализуемо; схема валидации остаётся на сервере. */}
          {prefilled && <p className="mb-4 rounded-xl bg-info-soft px-3 py-2 text-sm text-info">Часть полей заполнена по ссылке. Проверьте их перед отправкой.</p>}
          {/* key: другая ссылка с другими значениями пересоздаёт форму без старых значений. */}
          <RequestForm key={JSON.stringify(defaults)} type={type} fields={spec.fields.map((f) => ({ ...f }))} defaults={defaults} />
        </Card>
      </>
    );
  }

  return (
    <>
      <BackLink href="/requests">Заявки</BackLink>
      <PageTitle sub="Справки, заявления и обращения в деканат. Статус придёт в уведомления.">Новая заявка</PageTitle>
      <RequestPicker
        items={Object.entries(requestCatalog).map(([key, s]) => ({ key, title: s.title, description: s.description, category: s.category, slaDays: s.slaDays }))}
      />
    </>
  );
}
