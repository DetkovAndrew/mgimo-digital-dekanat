import { BookOpen, Dumbbell, FileText, GraduationCap, House, Languages, LifeBuoy, type LucideIcon, MessagesSquare, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { IconTile, PageTitle } from "@/components/ui";
import type { Tone } from "@/lib/format";
import { requestCatalog } from "@/lib/requests/catalog";
import { mailtoHref, officeSubject, SUPPORT_OFFICES } from "@/lib/support/offices";
import { getMyProfile } from "@/server/dal/profile";
import { CopyButton } from "../wifi/wifi-parts";

// «Куда обратиться» (опрос 15.11): служба, с чем к ней идти, заявки кабинета по теме и готовая тема письма.
// Службы и адреса вымышленные; в теме письма уже подставлена группа студента.

export const dynamic = "force-dynamic";

const LOOK: Record<string, { icon: LucideIcon; tone: Tone | "brand" }> = {
  dean: { icon: GraduationCap, tone: "brand" },
  scholarship: { icon: Wallet, tone: "ok" },
  contract: { icon: FileText, tone: "neutral" },
  it: { icon: LifeBuoy, tone: "info" },
  military: { icon: ShieldCheck, tone: "neutral" },
  international: { icon: Languages, tone: "info" },
  campus: { icon: House, tone: "warn" },
  sport: { icon: Dumbbell, tone: "warn" },
  care: { icon: MessagesSquare, tone: "ok" },
  library: { icon: BookOpen, tone: "brand" },
};

export default async function SupportPage() {
  const { group } = await getMyProfile();

  return (
    <>
      <BackLink href="/services">Сервисы</BackLink>
      <PageTitle sub="С чем идти в каждую службу и что написать в теме письма. Через заявку быстрее: статус виден в кабинете.">Куда обратиться</PageTitle>

      <p className="mb-6 flex items-start gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-ink">
        <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
        <span>Не знаете, какая служба нужна? Опишите ситуацию Инвиктии — кружок в углу экрана: она подскажет службу, тему письма и нужную заявку.</span>
      </p>

      <div className="space-y-3">
        {SUPPORT_OFFICES.map((o) => {
          const look = LOOK[o.id] ?? { icon: LifeBuoy, tone: "neutral" as const };
          const subject = officeSubject(o, group);
          return (
            <section key={o.id} id={o.id} aria-labelledby={`${o.id}-title`} className="scroll-mt-20 rounded-2xl bg-surface p-4 ring-1 ring-hairline target:ring-2 target:ring-brand">
              <div className="mb-3 flex items-start gap-3">
                <IconTile icon={look.icon} tone={look.tone} />
                <div className="min-w-0">
                  <h2 id={`${o.id}-title`} className="text-lead font-semibold">
                    {o.title}
                  </h2>
                  <p className="text-sm text-ink-2">
                    {o.where} · {o.hours}
                  </p>
                </div>
              </div>

              <ul className="mb-3 list-disc space-y-0.5 pl-5 text-body">
                {o.topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {o.note && <p className="mb-3 text-sm text-ink-2">{o.note}</p>}

              {o.requests.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-sm font-medium text-ink-2">Заявкой в кабинете</p>
                  <ul className="flex flex-wrap gap-x-4">
                    {o.requests.map((type) => (
                      <li key={type}>
                        <Link
                          href={`/requests/new?type=${type}`}
                          transitionTypes={["nav-forward"]}
                          className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-2 hover:underline"
                        >
                          {requestCatalog[type].title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl bg-fill px-3 py-2">
                <p className="text-sm text-ink-2">
                  Письмом:{" "}
                  <a href={mailtoHref(o, group)} className="inline-flex min-h-11 items-center font-medium break-all text-brand underline-offset-2 hover:underline">
                    {o.email}
                  </a>
                </p>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="text-ink-2">Тема: </span>
                    {subject}
                  </p>
                  <CopyButton value={subject} label={`Тема письма: ${o.title}`} />
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-4 px-1 text-xs text-ink-3">Службы, адреса и часы работы демонстрационные: письма на них не доставляются.</p>
    </>
  );
}
