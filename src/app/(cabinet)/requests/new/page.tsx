import { BackLink } from "@/components/back-link";
import { FileCheck2, FilePen, MessageCircleQuestion } from "lucide-react";
import { Card, IconTile, List, PageTitle, RowLink, Section } from "@/components/ui";
import { isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { prefillFor } from "@/lib/requests/prefill";
import { RequestForm } from "./request-form";

const groups = [
  { category: "certificate", title: "Справки", icon: FileCheck2, tone: "info" },
  { category: "application", title: "Заявления", icon: FilePen, tone: "brand" },
  { category: "question", title: "Вопрос", icon: MessageCircleQuestion, tone: "warn" },
] as const;

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
      <PageTitle>Новая заявка</PageTitle>
      {groups.map((g) => (
        <Section key={g.category} title={g.title}>
          <List>
            {Object.entries(requestCatalog)
              .filter(([, s]) => s.category === g.category)
              .map(([key, s]) => (
                <RowLink key={key} href={`/requests/new?type=${key}`}>
                  <span className="flex items-center gap-3">
                    <IconTile icon={g.icon} tone={g.tone} />
                    <span className="min-w-0">
                      <span className="block font-medium">{s.title}</span>
                      <span className="block text-sm text-ink-2">{s.description}</span>
                    </span>
                  </span>
                </RowLink>
              ))}
          </List>
        </Section>
      ))}
    </>
  );
}
