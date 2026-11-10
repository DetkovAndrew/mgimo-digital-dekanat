import { PointsBar } from "@/components/points-bar";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { controlFormLabel, formatDate, type Tone } from "@/lib/format";
import { bandFor, disciplineProgress, formatPoints, PASS_POINTS, SCALE } from "@/lib/grading";
import { getMyGrades, type MyTerm } from "@/server/dal/grades";

type Offering = MyTerm["offerings"][number];
type Assessment = Offering["assessments"][number];

/** Единое правило даты точки: срок сдачи, а если его нет — дата проведения. */
const dateOf = (a: Assessment) => a.dueAt ?? a.scheduledAt ?? null;
const isFinal = (o: Offering, a: Assessment) => a.kind === o.controlForm;

function progressOf(o: Offering, now: Date) {
  return disciplineProgress(
    o.assessments.map((a) => ({
      maxPoints: a.maxPoints ?? 0,
      points: a.results.at(-1)?.points ?? null,
      isFinal: isFinal(o, a),
      date: dateOf(a),
    })),
    now,
  );
}

const bandTone = (points: number): Tone => (points >= 75 ? "ok" : points >= 60 ? "info" : "warn");

function nextBandHint(points: number) {
  const next = [...SCALE].reverse().find((b) => b.from > points);
  return next ? `до ${next.ects} · ${next.grade} ещё ${formatPoints(next.from - points)}` : "это максимум";
}

function CurrentOffering({ o, now }: { o: Offering; now: Date }) {
  const p = progressOf(o, now);
  const credit = o.controlForm === "CREDIT"; // обычный зачёт: без оценки, только «зачтено/нет»
  const final = o.assessments.find((a) => isFinal(o, a));
  const next = o.assessments
    .filter((a) => !isFinal(o, a) && !a.results.length && (dateOf(a) ?? now) >= now)
    .sort((x, y) => (dateOf(x)?.getTime() ?? Infinity) - (dateOf(y)?.getTime() ?? Infinity))[0];

  let badge: { tone: Tone; text: string } | null = null;
  if (p.earned >= PASS_POINTS) {
    badge = credit ? { tone: "ok", text: "порог зачёта пройден" } : { tone: bandTone(p.earned), text: `${p.band.ects} · ${p.band.grade}` };
  } else if (p.forecast) {
    badge = credit
      ? { tone: p.atRisk ? "bad" : "neutral", text: p.atRisk ? "риск незачёта" : "идёт к зачёту" }
      : { tone: p.atRisk ? "bad" : "neutral", text: `прогноз ${p.forecast.ects} · ${p.forecast.grade}` };
  }

  const paceText =
    p.pace === null
      ? `Оценок пока нет. Всего можно набрать ${formatPoints(p.remaining + p.pending)}.`
      : `${formatPoints(p.earned)} из ${formatPoints(p.graded)} за оценённые работы (${Math.round(p.pace * 100)}%).`;

  return (
    <Card className="!p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug">{o.discipline.title}</h3>
          <p className="text-xs text-slate-500">
            {controlFormLabel[o.controlForm]}
            {final?.scheduledAt && ` ${formatDate(final.scheduledAt)}`} · {o.credits} з.е. · {o.leadTeacher.fullName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold leading-none tabular-nums">
            {formatPoints(p.earned)}
            <span className="text-sm font-normal text-slate-400"> / 100</span>
          </p>
          {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
        </div>
      </div>

      <div className="mt-3">
        <PointsBar earned={p.earned} remaining={p.remaining + p.pending} />
      </div>

      <p className={`mt-2 text-sm ${p.atRisk ? "text-red-700" : "text-slate-600"}`}>
        {p.toPass === 0 ? (
          credit ? (
            "Порог 60 пройден — осталось получить зачёт."
          ) : (
            `Порог ${PASS_POINTS} пройден, ${nextBandHint(p.earned)}.`
          )
        ) : p.atRisk ? (
          <>
            <b>Зона риска.</b> {paceText} При таком темпе до {PASS_POINTS} не дотянуть — обсудите с преподавателем, как
            добрать.
          </>
        ) : (
          <>
            {paceText} До {PASS_POINTS} осталось {formatPoints(p.toPass)}.
          </>
        )}
        {p.pending > 0 && ` На проверке ещё ${formatPoints(p.pending)} б.`}
        {next && (
          <>
            {" "}
            Ближайшая возможность: <b>{next.title}</b> ({next.maxPoints} б.)
            {dateOf(next) && `, до ${formatDate(dateOf(next)!)}`}.
          </>
        )}
      </p>

      <details className="group mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-brand">
          <span className="group-open:hidden">Контрольные точки ▾</span>
          <span className="hidden group-open:inline">Скрыть ▴</span>
        </summary>
        <ul className="divide-y divide-slate-100 text-sm">
          {o.assessments.map((a) => {
            const r = a.results.at(-1);
            const date = dateOf(a);
            const waiting = !r && date && date < now && !isFinal(o, a);
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  {a.title}
                  {date && (
                    <span className="block text-xs text-slate-500">
                      {formatDate(date)}
                      {waiting && " · на проверке"}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 tabular-nums ${r ? "font-medium" : "text-slate-400"}`}>
                  {r?.points != null ? formatPoints(r.points) : "—"} / {a.maxPoints}
                </span>
              </li>
            );
          })}
        </ul>
      </details>
    </Card>
  );
}

function PastOffering({ o, now }: { o: Offering; now: Date }) {
  const final = o.assessments.find((a) => isFinal(o, a));
  const attempts = final?.results ?? [];
  const last = attempts.at(-1);
  const total = progressOf(o, now).earned; // сумма по всем точкам семестра
  const result =
    last?.passed != null
      ? { tone: (last.passed ? "ok" : "bad") as Tone, text: last.passed ? "зачтено" : "не зачтено" }
      : last
        ? { tone: bandTone(total), text: `${bandFor(total).ects} · ${last.grade ?? bandFor(total).grade}` }
        : null;

  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{o.discipline.title}</span>
        <span className="text-xs text-slate-500">
          {controlFormLabel[o.controlForm]}
          {attempts.length > 1 && ` · попытки: ${attempts.map((r) => formatPoints(r.points ?? 0)).join(" → ")}`}
        </span>
      </span>
      {result && (
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums">{formatPoints(total)}</span>
          <Badge tone={result.tone}>{result.text}</Badge>
        </span>
      )}
    </li>
  );
}

export default async function GradesPage() {
  const terms = await getMyGrades();
  if (!terms.length) return <Empty>Данных об успеваемости пока нет.</Empty>;
  const now = new Date();
  const [current, ...past] = terms;
  const atRisk = current.offerings.filter((o) => progressOf(o, now).atRisk).length;

  return (
    <>
      <PageTitle>Учёба</PageTitle>
      <section className="mb-8">
        <h2 className="font-semibold">{current.title}</h2>
        <p className="mb-3 text-sm text-slate-500">
          Сессия: {formatDate(current.sessionStartsOn)} — {formatDate(current.sessionEndsOn)} ·{" "}
          {atRisk ? `в зоне риска: ${atRisk} из ${current.offerings.length}` : "все дисциплины идут в плюс"}
        </p>
        <div className="space-y-2">
          {current.offerings.map((o) => (
            <CurrentOffering key={o.id} o={o} now={now} />
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Шкала University (демо): 60 — E, 68 — D, 75 — C, 84 — B, 91 — A. Штриховка — баллы, которые ещё можно
          набрать. Прогноз — итог при том же темпе; появляется, когда оценено от 20 баллов.
        </p>
      </section>

      {past.map((term) => (
        <section key={term.id} className="mb-6">
          <h2 className="mb-2 font-semibold">{term.title}</h2>
          <Card className="!py-1">
            <ul className="divide-y divide-slate-100">
              {term.offerings.map((o) => (
                <PastOffering key={o.id} o={o} now={now} />
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </>
  );
}
