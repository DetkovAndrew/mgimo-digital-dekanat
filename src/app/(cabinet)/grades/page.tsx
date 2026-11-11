import Link from "next/link";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { controlFormLabel, formatDate } from "@/lib/format";
import { assessmentDate, courseProgress, courseStatus, formatPoints, nextAssessment } from "@/lib/grading";
import { getMyGrades, type MyTerm } from "@/server/dal/grades";

type Offering = MyTerm["offerings"][number];

/** Одна строка на дисциплину: баллы, статус и ближайшая работа. Подробности — на странице дисциплины. */
function OfferingRow({ o, now, past }: { o: Offering; now: Date; past?: boolean }) {
  const p = courseProgress(o.controlForm, o.assessments, now);
  const status = courseStatus(o.controlForm, o.assessments, now);
  const next = past ? null : nextAssessment(o.assessments, now);
  const nextDate = next && assessmentDate(next);
  const attempts = past ? (o.assessments.find((a) => a.kind === o.controlForm)?.results ?? []) : [];

  return (
    <li>
      <Link href={`/courses/${o.id}`} className="flex min-h-11 items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{o.discipline.title}</span>
          <span className="block text-xs text-slate-500">
            {next ? (
              <>
                Дальше: {next.title}
                {nextDate && `, ${formatDate(nextDate)}`}
              </>
            ) : (
              controlFormLabel[o.controlForm]
            )}
            {attempts.length > 1 && ` · попытки: ${attempts.map((r) => formatPoints(r.points ?? 0)).join(" → ")}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">
            {formatPoints(p.earned)}
            <span className="text-xs font-normal text-slate-400"> / 100</span>
          </span>
          <Badge tone={status.tone}>{status.text}</Badge>
        </span>
        <span aria-hidden className="shrink-0 text-slate-300">
          ›
        </span>
      </Link>
    </li>
  );
}

export default async function GradesPage() {
  const terms = await getMyGrades();
  if (!terms.length) return <Empty>Данных об успеваемости пока нет.</Empty>;
  const now = new Date();
  const [current, ...past] = terms;

  return (
    <>
      <PageTitle>Учёба</PageTitle>
      <section className="mb-6">
        <h2 className="font-semibold">{current.title}</h2>
        <p className="mb-2 text-sm text-slate-500">
          Сессия: {formatDate(current.sessionStartsOn)} — {formatDate(current.sessionEndsOn)}
        </p>
        <Card className="!py-0">
          <ul className="divide-y divide-slate-100">
            {current.offerings.map((o) => (
              <OfferingRow key={o.id} o={o} now={now} />
            ))}
          </ul>
        </Card>
      </section>

      {past.map((term) => (
        <details key={term.id} className="mb-3 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-black/5">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">{term.title}</summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {term.offerings.map((o) => (
              <OfferingRow key={o.id} o={o} now={now} past />
            ))}
          </ul>
        </details>
      ))}
    </>
  );
}
