import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { Badge, Disclosure, Empty, List, PageTitle, RowLink, Section } from "@/components/ui";
import { controlFormLabel, formatDate, formatShortDate, mskStartOfDay } from "@/lib/format";
import { assessmentDate, courseProgress, courseStatus, formatPoints, nextAssessment } from "@/lib/grading";
import { getMyGrades, type MyTerm } from "@/server/dal/grades";
import { courseTitleName } from "@/lib/view-transitions";

type Offering = MyTerm["offerings"][number];

const days = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "день" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "дня" : "дней");

/** Одна строка на дисциплину: баллы, полоса до порога 60 и ближайшая работа. Подробности на странице дисциплины. */
function OfferingRow({ o, now, past }: { o: Offering; now: Date; past?: boolean }) {
  const p = courseProgress(o.controlForm, o.assessments, now);
  const status = courseStatus(o.controlForm, o.assessments, now);
  const next = past ? null : nextAssessment(o.assessments, now);
  const nextDate = next && assessmentDate(next);
  const attempts = past ? (o.assessments.find((a) => a.kind === o.controlForm)?.results ?? []) : [];

  return (
    <RowLink href={`/courses/${o.id}`}>
      <span className="flex items-baseline justify-between gap-3">
        {past ? (
          <span className="min-w-0 leading-snug font-medium">{o.discipline.title}</span>
        ) : (
          <ViewTransition name={courseTitleName(o.id)} share="morph" default="none">
            <span className="min-w-0 leading-snug font-medium">{o.discipline.title}</span>
          </ViewTransition>
        )}
        <span className="shrink-0 text-lead font-semibold tabular-nums">
          {formatPoints(p.earned)}
          <span className="text-xs font-normal text-ink-3"> / 100</span>
        </span>
      </span>
      {!past && (
        <span aria-hidden className="relative my-2 block h-1.5 overflow-hidden rounded-full bg-fill">
          <span className={`absolute inset-y-0 left-0 rounded-full ${p.earned >= 60 ? "bg-ok" : "bg-brand-fill"}`} style={{ width: `${Math.min(100, p.earned)}%` }} />
          <span className="absolute inset-y-0 left-[60%] w-px bg-ink-3" />
        </span>
      )}
      <span className="flex items-center justify-between gap-3 text-xs text-ink-2">
        <span className="min-w-0">
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
        {/* Нейтральный статус («до 60 ещё 25») тихим текстом; цветная плашка только для итога или риска. */}
        {status.tone === "neutral" ? <span className="shrink-0 tabular-nums">{status.text}</span> : <Badge tone={status.tone}>{status.text}</Badge>}
      </span>
    </RowLink>
  );
}

/** Сводка семестра: сколько до сессии, сколько работ уже оценено, что сдавать первым. */
function TermSummary({ term, now }: { term: MyTerm; now: Date }) {
  const dayDiff = (d: Date) => Math.round((mskStartOfDay(d).getTime() - mskStartOfDay(now).getTime()) / 86_400_000);
  const left = dayDiff(term.sessionStartsOn);
  const over = dayDiff(term.sessionEndsOn) < 0;
  // Факт, а не прогноз: сколько работ семестра уже оценено (итоговые аттестации не считаем).
  const works = term.offerings.flatMap((o) => o.assessments.filter((a) => a.kind !== o.controlForm));
  const done = works.filter((a) => a.results.length).length;
  const soonest = term.offerings
    .map((o) => ({ o, a: nextAssessment(o.assessments, now) }))
    .filter((x) => x.a && assessmentDate(x.a))
    .sort((x, y) => assessmentDate(x.a!)!.getTime() - assessmentDate(y.a!)!.getTime())[0];

  return (
    <section aria-label="Сводка семестра" className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-hairline ring-1 ring-hairline">
      <div className="bg-surface p-4">
        <p className="text-sm text-ink-2">{left > 0 ? "До сессии" : "Сессия"}</p>
        <p className="mt-1 text-h1 font-bold tracking-tight tabular-nums">
          {left > 0 ? left : over ? "позади" : "идёт"}
          {left > 0 && <span className="ml-1 text-body font-medium text-ink-2">{days(left)}</span>}
        </p>
      </div>
      <div className="bg-surface p-4">
        <p className="text-sm text-ink-2">Работ оценено</p>
        <p className="mt-1 text-h1 font-bold tracking-tight tabular-nums">
          {done}
          <span className="ml-1 text-body font-medium text-ink-2">из {works.length}</span>
        </p>
      </div>
      {soonest && (
        <Link
          href={`/courses/${soonest.o.id}`}
          transitionTypes={["nav-forward"]}
          className="col-span-2 flex min-h-14 items-center gap-3 bg-surface px-4 py-3 transition-colors focus-visible:-outline-offset-2 active:bg-fill md:hover:bg-fill/70"
        >
          <CalendarClock aria-hidden className="size-5 shrink-0 text-warn" />
          <span className="min-w-0 text-sm">
            <span className="block text-ink-2">Сдать первым</span>
            <span className="block font-medium">
              {soonest.a!.title}, {soonest.o.discipline.title} · {formatShortDate(assessmentDate(soonest.a!)!)}
            </span>
          </span>
        </Link>
      )}
    </section>
  );
}

export default async function GradesPage() {
  const terms = await getMyGrades();
  if (!terms.length) return <Empty>Данных об успеваемости пока нет.</Empty>;
  const now = new Date();
  const [current, ...past] = terms;

  return (
    <>
      <PageTitle sub={`Сессия с ${formatDate(current.sessionStartsOn)} по ${formatDate(current.sessionEndsOn)}`}>Учёба</PageTitle>
      <TermSummary term={current} now={now} />
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
