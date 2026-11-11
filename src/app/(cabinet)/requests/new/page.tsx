import { BackLink } from "@/components/back-link";
import { Card, List, PageTitle, RowLink, Section } from "@/components/ui";
import { isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { RequestForm } from "./request-form";

const groups = [
  { category: "certificate", title: "Справки" },
  { category: "application", title: "Заявления" },
  { category: "question", title: "Вопрос" },
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
                  <span className="block font-medium">{s.title}</span>
                  <span className="block text-sm text-slate-500">{s.description}</span>
                </RowLink>
              ))}
          </List>
        </Section>
      ))}
    </>
  );
}
