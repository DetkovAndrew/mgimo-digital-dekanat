import { MapPin } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Badge, Disclosure, Empty, PageTitle, Section } from "@/components/ui";
import { buildingTitle, PRINTERS, printerById, printerLink, printerStatusLabel } from "@/lib/campus/printers";
import { formatDateTime } from "@/lib/format";
import { formatPrintCode, PRINT_RULES } from "@/lib/services/print";
import { getMyPrint } from "@/server/dal/print";
import { JobActions } from "./job-actions";
import { PrintForm } from "./print-form";

// Печать по коду (docs/plans/services.md): задание, код, любой исправный принтер. Демо: принтеры вымышлены.

export const dynamic = "force-dynamic";

const month = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", month: "long" });
const monthIn = (d: Date) => {
  const m = month.format(d);
  // «ноябрь» → «в ноябре», «май» → «в мае»: родительный падеж здесь не нужен, нужен предложный.
  return `в ${m.endsWith("й") || m.endsWith("ь") ? m.slice(0, -1) + "е" : m + "е"}`;
};
const params = (j: { pages: number; copies: number; color: boolean; duplex: boolean }) =>
  `${j.pages} стр. × ${j.copies}, ${j.color ? "цветная" : "ч/б"}${j.duplex ? ", с двух сторон" : ""}`;

export default async function PrintPage() {
  const p = await getMyPrint();
  const share = Math.round((p.left / p.limit) * 100);

  return (
    <>
      <BackLink href="/services">Сервисы</BackLink>
      <PageTitle sub="Отправьте задание и заберите листы у любого исправного принтера по коду. Демо: принтеры вымышлены.">Печать</PageTitle>

      <section aria-label="Остаток страниц" className="mb-7 rounded-3xl bg-surface p-5 ring-1 ring-hairline">
        <p className="text-sm text-ink-2">Осталось {monthIn(new Date())}</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-display leading-none font-bold tabular-nums">{p.left}</span>
          <span className="text-lead text-ink-2">из {p.limit} страниц</span>
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-fill" role="progressbar" aria-label="Остаток страниц" aria-valuemin={0} aria-valuemax={p.limit} aria-valuenow={p.left}>
          <div className={`h-full rounded-full ${share > 20 ? "bg-brand-fill" : "bg-warn"}`} style={{ width: `${share}%` }} />
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Цветная страница считается за {PRINT_RULES.colorFactor}. Отменённые и просроченные задания страниц не тратят. Лимит обновляется 1-го числа.
        </p>
      </section>

      {p.queued.length > 0 && (
        <Section title="Ждут у принтера">
          <ul className="space-y-3">
            {p.queued.map((j) => (
              <li key={j.id} className="rounded-2xl bg-surface p-4 ring-1 ring-hairline">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{j.fileName}</p>
                    <p className="text-sm text-ink-2">
                      {params(j)} · {j.cost} стр.
                    </p>
                  </div>
                  <Badge tone="info">В очереди</Badge>
                </div>
                <div className="mt-3 rounded-xl bg-page px-4 py-3 text-center ring-1 ring-hairline">
                  <p className="text-xs text-ink-2">Код для принтера</p>
                  <p className="font-mono text-h1 leading-tight font-bold tracking-widest tabular-nums" aria-label={`Код ${j.code.split("").join(" ")}`}>
                    {formatPrintCode(j.code)}
                  </p>
                  <p className="text-xs text-ink-3">Действует до {formatDateTime(j.expiresAt)}</p>
                </div>
                <JobActions id={j.id} color={j.color} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Новое задание">
        <PrintForm left={p.left} />
      </Section>

      <Section title="Принтеры" id="printers">
        <ul className="divide-y divide-hairline rounded-2xl bg-surface ring-1 ring-hairline">
          {PRINTERS.map((pr) => {
            const st = printerStatusLabel[pr.status];
            return (
              <li key={pr.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {pr.title}
                    <span className="font-normal text-ink-2">{pr.color ? " · цветной" : " · ч/б"}</span>
                  </p>
                  <Link href={printerLink(pr)} transitionTypes={["nav-forward"]} className="inline-flex min-h-11 items-center gap-1 text-sm text-brand">
                    <MapPin aria-hidden className="size-3.5" />
                    {buildingTitle(pr.buildingId)}, {pr.floor} этаж, ауд. {pr.room}
                  </Link>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </li>
            );
          })}
        </ul>
      </Section>

      <Disclosure title="История печати">
        {p.history.length ? (
          <ul className="divide-y divide-hairline rounded-2xl bg-surface ring-1 ring-hairline">
            {p.history.map((j) => {
              const where = j.printerId ? printerById(j.printerId) : null;
              return (
                <li key={j.id} className="px-4 py-3 text-sm">
                  <p className="flex items-start justify-between gap-3">
                    <span className="min-w-0 font-medium break-words">{j.fileName}</span>
                    <Badge tone={j.status === "PRINTED" ? "ok" : "neutral"}>{j.status === "PRINTED" ? "Напечатано" : j.expired ? "Срок истёк" : "Отменено"}</Badge>
                  </p>
                  <p className="text-ink-2">
                    {params(j)}
                    {j.status === "PRINTED" && where && j.printedAt ? ` · ${where.title}, ${formatDateTime(j.printedAt)}` : ` · ${formatDateTime(j.createdAt)}`}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Здесь появятся напечатанные и отменённые задания.</Empty>
        )}
      </Disclosure>
    </>
  );
}
