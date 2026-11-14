import { BadgeCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import { verifyCertificate } from "@/server/dal/documents";
import { clientKey, takeVerifySlot } from "@/server/documents/verify-limit";
import { VerifyShell } from "../shell";

// Открытая страница проверки справки (docs/plans/certificates.md): без входа, только по токену из QR.
// Показывает поля PublicCertificate из снимка на дату выдачи; токен в адресе не уходит дальше (no-referrer).
export const metadata: Metadata = {
  title: "Проверка справки · University",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyPage({ params }: PageProps<"/verify/[token]">) {
  const { token } = await params;
  if (!takeVerifySlot(clientKey((await headers()).get("x-forwarded-for")))) {
    return (
      <VerifyShell>
        <div className="rounded-3xl bg-surface p-6 ring-1 ring-hairline">
          <Clock aria-hidden className="mb-3 size-8 text-warn" />
          <h1 className="mb-2 text-title font-semibold">Слишком много проверок</h1>
          <p className="text-body text-ink-2">С этого адреса за минуту проверили много справок. Подождите минуту и обновите страницу.</p>
        </div>
      </VerifyShell>
    );
  }
  const doc = await verifyCertificate(token);
  if (!doc) notFound();

  const rows: [string, string][] = [
    ["Документ", doc.title],
    ["Номер", doc.number],
    ["Дата выдачи", formatDate(doc.issuedAt)],
    ["Студент", doc.holder],
    ["Факультет", doc.faculty],
    ["Курс", String(doc.course)],
    ["Форма обучения", doc.studyForm],
  ];
  return (
    <VerifyShell>
      <div className="rounded-3xl bg-surface p-6 ring-1 ring-hairline">
        <span aria-hidden className="mb-4 grid size-12 place-items-center rounded-full bg-ok-soft text-ok">
          <BadgeCheck className="size-7" />
        </span>
        <h1 className="mb-1 text-title font-semibold">Справка найдена</h1>
        <p className="mb-4 text-body text-ink-2">Справка с этим номером выпущена в демо-реестре University.</p>
        <dl className="divide-y divide-hairline text-body">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2.5">
              <dt className="text-ink-2">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-4 text-body text-ink-2">
        Сверьте эти данные с документом. Страница подтверждает только запись в реестре: если данные в PDF отличаются,
        документ изменили после выдачи.
      </p>
    </VerifyShell>
  );
}
