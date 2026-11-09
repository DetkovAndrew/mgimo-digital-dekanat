import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
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
        <Link href="/requests/new" className="mb-3 inline-block text-sm text-brand">
          ← Все виды заявок
        </Link>
        <PageTitle>{spec.title}</PageTitle>
        <p className="-mt-2 mb-4 text-sm text-slate-500">
          {spec.description} Обычно готово за {spec.slaDays} раб. дн. (демо-срок).
        </p>
        <Card>
          {/* Описание полей сериализуемо; схема валидации остаётся на сервере. */}
          <RequestForm type={type} fields={spec.fields.map((f) => ({ ...f }))} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle>Новая заявка</PageTitle>
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.category}>
            <h2 className="mb-2 font-semibold">{g.title}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(requestCatalog)
                .filter(([, s]) => s.category === g.category)
                .map(([key, s]) => (
                  <Link
                    key={key}
                    href={`/requests/new?type=${key}`}
                    className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 hover:ring-brand/40"
                  >
                    <span className="block font-medium">{s.title}</span>
                    <span className="text-sm text-slate-500">{s.description}</span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
