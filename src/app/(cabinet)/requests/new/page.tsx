import { BackLink } from "@/components/back-link";
import { FileCheck2, FilePen, MessageCircleQuestion } from "lucide-react";
import { Card, IconTile, List, PageTitle, RowLink, Section } from "@/components/ui";
import { isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { RequestForm } from "./request-form";

const groups = [
  { category: "certificate", title: "Справки", icon: FileCheck2, tone: "info" },
  { category: "application", title: "Заявления", icon: FilePen, tone: "brand" },
  { category: "question", title: "Вопрос", icon: MessageCircleQuestion, tone: "warn" },
] as const;

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const { type } = await searchParams;

  if (typeof type === "string" && isRequestType(type)) {
    const spec = requestCatalog[type];
    return (
      <>
        <BackLink href="/requests/new">Виды заявок</BackLink>
        <PageTitle sub={`${spec.description} Обычно готово за ${spec.slaDays} раб. дн. (демо-срок).`}>{spec.title}</PageTitle>
        <Card>
          {/* Описание полей сериализуемо; схема валидации остаётся на сервере. */}
          <RequestForm type={type} fields={spec.fields.map((f) => ({ ...f }))} />
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
