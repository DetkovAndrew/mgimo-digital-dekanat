import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { controlFormLabel, formatDate } from "@/lib/format";
import { getMyGrades } from "@/server/dal/grades";

type Result = { attempt: number; grade: number | null; passed: boolean | null; points: number | null };

function resultLabel(r: Result) {
  if (r.grade !== null) return String(r.grade);
  if (r.passed !== null) return r.passed ? "зачтено" : "не зачтено";
  return r.points !== null ? `${r.points} б.` : "—";
}

function resultTone(r: Result) {
  if (r.grade !== null) return r.grade >= 4 ? "ok" : r.grade === 3 ? "warn" : "bad";
  return r.passed ? "ok" : "bad";
}

export default async function GradesPage() {
  const terms = await getMyGrades();
  if (!terms.length) return <Empty>Данных об успеваемости пока нет.</Empty>;

  return (
    <>
      <PageTitle>Учёба</PageTitle>
      <div className="space-y-8">
        {terms.map((term) => (
          <section key={term.id}>
            <h2 className="mb-1 font-semibold">{term.title}</h2>
            <p className="mb-3 text-sm text-slate-500">
              Сессия: {formatDate(term.sessionStartsOn)} — {formatDate(term.sessionEndsOn)}
            </p>
            <div className="space-y-2">
              {term.offerings.map((o) => {
                const final = o.assessments.find((a) => a.kind === o.controlForm);
                const finalResult = final?.results.at(-1);
                const current = o.assessments.filter((a) => a.kind !== o.controlForm);
                return (
                  <Card key={o.id} className="!p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium leading-snug">{o.discipline.title}</h3>
                        <p className="text-xs text-slate-500">
                          {controlFormLabel[o.controlForm]} · {o.credits} з.е. · {o.leadTeacher.fullName}
                        </p>
                      </div>
                      {finalResult ? (
                        <Badge tone={resultTone(finalResult)}>{resultLabel(finalResult)}</Badge>
                      ) : (
                        final?.scheduledAt && <span className="shrink-0 text-xs text-slate-500">{formatDate(final.scheduledAt)}</span>
                      )}
                    </div>
                    {final && final.results.length > 1 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Попытки: {final.results.map((r) => `${r.attempt}) ${resultLabel(r)}`).join(", ")}
                      </p>
                    )}
                    {current.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {current.map((a) => {
                          const r = a.results.at(-1);
                          return (
                            <li key={a.id} className="rounded-lg bg-slate-50 px-2 py-1 text-xs">
                              {a.title}: <b>{r ? resultLabel(r) : a.dueAt ? `до ${formatDate(a.dueAt)}` : "—"}</b>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
