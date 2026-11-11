import { ViewTransition } from "react";
import { Badge, Disclosure, Empty, List, PageTitle, RowLink, Section } from "@/components/ui";
import { controlFormLabel, formatDate, formatShortDate } from "@/lib/format";
import { assessmentDate, courseProgress, courseStatus, formatPoints, nextAssessment } from "@/lib/grading";
import { getMyGrades, type MyTerm } from "@/server/dal/grades";
import { courseTitleName } from "@/lib/view-transitions";

type Offering = MyTerm["offerings"][number];

/** Одна строка на дисциплину: баллы, статус и ближайшая работа. Подробности — на странице дисциплины. */
function OfferingRow({ o, now, past }: { o: Offering; now: Date; past?: boolean }) {
  const p = courseProgress(o.controlForm, o.assessments, now);
  const status = courseStatus(o.controlForm, o.assessments, now);
  const next = past ? null : nextAssessment(o.assessments, now);
  const nextDate = next && assessmentDate(next);
  const attempts = past ? (o.assessments.find((a) => a.kind === o.controlForm)?.results ?? []) : [];

  return (
    <RowLink href={`/courses/${o.id}`}>
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          {past ? (
            <span className="block leading-snug font-medium">{o.discipline.title}</span>
          ) : (
            <ViewTransition name={courseTitleName(o.id)} share="morph" default="none">
              <span className="block w-fit leading-snug font-medium">{o.discipline.title}</span>
            </ViewTransition>
          )}
          {!past && (
            <span aria-hidden className="relative my-1.5 block h-1.5 max-w-48 overflow-hidden rounded-full bg-fill">
              <span className={`absolute inset-y-0 left-0 rounded-full ${p.earned >= 60 ? "bg-ok" : "bg-brand-fill"}`} style={{ width: `${Math.min(100, p.earned)}%` }} />
              <span className="absolute inset-y-0 left-[60%] w-px bg-ink-3" />
            </span>
          )}
          <span className="block text-xs text-ink-2">
            {next ? (
              <>
                {next.title}
                {nextDate && ` · ${formatShortDate(nextDate)}`}
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
            <span className="text-xs font-normal text-ink-3"> / 100</span>
          </span>
          <Badge tone={status.tone}>{status.text}</Badge>
        </span>
      </span>
    </RowLink>
  );
}

export default async function GradesPage() {
  const terms = await getMyGrades();
  if (!terms.length) return <Empty>Данных об успеваемости пока нет.</Empty>;
  const now = new Date();
  const [current, ...past] = terms;

  return (
    <>
      <PageTitle sub={`Сессия ${formatDate(current.sessionStartsOn)} — ${formatDate(current.sessionEndsOn)}`}>Учёба</PageTitle>
      <Section title={current.title}>
        <List>
          {current.offerings.map((o) => (
            <OfferingRow key={o.id} o={o} now={now} />
          ))}
        </List>
      </Section>

      {past.map((term) => (
        <Disclosure key={term.id} title={term.title} className="mb-4">
          <List>
            {term.offerings.map((o) => (
              <OfferingRow key={o.id} o={o} now={now} past />
            ))}
          </List>
        </Disclosure>
      ))}
    </>
  );
}
