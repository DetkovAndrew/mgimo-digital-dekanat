import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { PointsBar } from "@/components/points-bar";
import { Badge, Card } from "@/components/ui";
import { controlFormLabel, formatDate, formatDay, formatTime, lessonKindLabel } from "@/lib/format";
import { assessmentDate, courseProgress, courseStatus, formatPoints, officialResult, PASS_POINTS } from "@/lib/grading";
import { getMyCourse } from "@/server/dal/courses";

export default async function CoursePage({ params }: PageProps<"/courses/[id]">) {
  const { id } = await params;
  const c = await getMyCourse(id);
  const now = new Date();
  const p = courseProgress(c.controlForm, c.assessments, now);
  const status = courseStatus(c.controlForm, c.assessments, now);
  const official = officialResult(c.controlForm, c.assessments);
  const final = c.assessments.find((a) => a.kind === c.controlForm);
  // По дате, аттестация — последней (в БД у работ срок в dueAt, у экзамена — scheduledAt).
  const ordered = [...c.assessments].sort(
    (x, y) =>
      Number(x.kind === c.controlForm) - Number(y.kind === c.controlForm) ||
      (assessmentDate(x)?.getTime() ?? Infinity) - (assessmentDate(y)?.getTime() ?? Infinity),
  );

  return (
    <>
      <BackLink href="/grades">Учёба</BackLink>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{c.discipline.title}</h1>
      <p className="mt-1 mb-4 text-sm text-slate-500">
        {c.term.title} · {controlFormLabel[c.controlForm]}
        {final?.scheduledAt && ` ${formatDate(final.scheduledAt)}`} · {c.credits} з.е.
      </p>

      <Card className="mb-3">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-3xl font-semibold tabular-nums">
            {formatPoints(p.earned)}
            <span className="text-base font-normal text-slate-400"> / 100</span>
          </p>
          <Badge tone={status.tone}>{status.text}</Badge>
        </div>
        <PointsBar earned={p.earned} remaining={p.remaining + p.pending} />
        <p className="mt-2 text-sm text-slate-600">
          {official
            ? official.passed
              ? "Итог аттестации выставлен."
              : "Аттестация не сдана — пересдача по графику деканата."
            : p.toPass > 0 && !p.passReachable
              ? `Даже с максимумом за оставшиеся работы до ${PASS_POINTS} не дотянуть — обсудите с преподавателем, как добрать.`
              : `${p.pending > 0 ? `На проверке ${formatPoints(p.pending)} б. ` : ""}Ещё можно набрать ${formatPoints(p.remaining)} б.`}
        </p>
      </Card>

      <Card className="mb-3 !py-2">
        <h2 className="pt-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Контрольные</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {ordered.map((a) => {
            const r = a.results.at(-1);
            const date = assessmentDate(a);
            const waiting = !r && date && date < now && a.kind !== c.controlForm;
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  {a.title}
                  {date && (
                    <span className="block text-xs text-slate-500">
                      {formatDate(date)}
                      {a.room && ` · ${a.room}`}
                      {waiting && " · на проверке"}
                      {a.results.length > 1 && ` · попытки: ${a.results.map((x) => formatPoints(x.points ?? 0)).join(" → ")}`}
                    </span>
                  )}
                  {r?.comment && <span className="block text-xs text-slate-500">{r.comment}</span>}
                </span>
                <span className={`shrink-0 tabular-nums ${r ? "font-medium" : "text-slate-400"}`}>
                  {r?.points != null ? formatPoints(r.points) : "—"} / {a.maxPoints}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {c.upcoming.length > 0 && (
        <Card className="mb-3 !py-2">
          <h2 className="pt-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Ближайшие пары</h2>
          <ul className="divide-y divide-slate-100">
            {c.upcoming.map((l) => (
              <li key={l.id}>
                <Link href={`/lessons/${l.id}`} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
                  <span className={l.status === "CANCELLED" ? "line-through opacity-70" : ""}>
                    {lessonKindLabel[l.kind]}: {formatDay(l.startsAt)}, {formatTime(l.startsAt)}
                    <span className="block text-xs text-slate-500">
                      {l.online ? "онлайн" : [l.room, l.building?.title].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-3 !py-2">
        <h2 className="pt-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Преподаватели</h2>
        <ul className="divide-y divide-slate-100">
          {c.teachers.map((t, i) => (
            <li key={t.id}>
              <Link href={`/teachers/${t.id}`} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
                <span>
                  {t.fullName}
                  <span className="block text-xs text-slate-500">
                    {i === 0 ? "ведущий преподаватель" : "ведёт часть занятий"}
                    {t.position && ` · ${t.position}`}
                  </span>
                </span>
                <span className="text-slate-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-slate-500">
        Шкала University (демо): 60 — E, 68 — D, 75 — C, 84 — B, 91 — A. Итоговая оценка выставляется на аттестации.
      </p>
    </>
  );
}
