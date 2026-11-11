import { ViewTransition } from "react";
import { UserRound } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { KindTile } from "@/components/kind";
import { PointsBar } from "@/components/points-bar";
import { Badge, Card, IconTile, List, RowLink, Section } from "@/components/ui";
import { controlFormLabel, formatDate, formatDay, formatTime, lessonKindLabel } from "@/lib/format";
import { assessmentDate, courseProgress, courseStatus, formatPoints, officialResult, PASS_POINTS } from "@/lib/grading";
import { courseTitleName } from "@/lib/view-transitions";
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
      <ViewTransition name={courseTitleName(c.id)} share="morph" default="none">
        <h1 className="w-fit text-[28px] leading-tight font-bold tracking-tight">{c.discipline.title}</h1>
      </ViewTransition>
      <p className="mt-1 mb-5 text-sm text-ink-2">
        {controlFormLabel[c.controlForm]}
        {final?.scheduledAt && ` ${formatDate(final.scheduledAt)}`} · {c.credits} з.е. · {c.term.title}
      </p>

      <Card className="mb-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-4xl font-bold tabular-nums">
            {formatPoints(p.earned)}
            <span className="text-base font-normal text-ink-3"> / 100</span>
          </p>
          <Badge tone={status.tone}>{status.text}</Badge>
        </div>
        <PointsBar earned={p.earned} remaining={p.remaining + p.pending} />
        <p className="mt-3 text-sm text-ink-2">
          {official
            ? official.passed
              ? "Итог аттестации выставлен."
              : "Аттестация не сдана — пересдача по графику деканата."
            : p.toPass > 0 && !p.passReachable
              ? `Даже с максимумом за оставшиеся работы до ${PASS_POINTS} не дотянуть — обсудите с преподавателем, как добрать.`
              : `${p.pending > 0 ? `На проверке ${formatPoints(p.pending)} б. ` : ""}Ещё можно набрать ${formatPoints(p.remaining)} б.`}
        </p>
      </Card>

      <Section title="Контрольные">
        <List>
          {ordered.map((a) => {
            const r = a.results.at(-1);
            const date = assessmentDate(a);
            const waiting = !r && date && date < now && a.kind !== c.controlForm;
            return (
              <li key={a.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{a.title}</span>
                  {date && (
                    <span className="block text-xs text-ink-2">
                      {formatDate(date)}
                      {a.room && ` · ${a.room}`}
                      {waiting && " · на проверке"}
                      {a.results.length > 1 && ` · попытки: ${a.results.map((x) => formatPoints(x.points ?? 0)).join(" → ")}`}
                    </span>
                  )}
                  {r?.comment && <span className="block text-xs text-ink-2">{r.comment}</span>}
                </span>
                <span className={`shrink-0 tabular-nums ${r ? "font-semibold" : "text-ink-3"}`}>
                  {r?.points != null ? formatPoints(r.points) : "—"}
                  <span className="font-normal text-ink-3"> / {a.maxPoints}</span>
                </span>
              </li>
            );
          })}
        </List>
      </Section>

      {c.upcoming.length > 0 && (
        <Section title="Ближайшие пары">
          <List>
            {c.upcoming.map((l) => (
              <RowLink key={l.id} href={`/lessons/${l.id}`}>
                <span className="flex items-center gap-3">
                  <KindTile kind={l.kind} />
                  <span className="min-w-0">
                    <span className={`block font-medium first-letter:uppercase ${l.status === "CANCELLED" ? "line-through opacity-70" : ""}`}>
                      {formatDay(l.startsAt)}, {formatTime(l.startsAt)}
                    </span>
                    <span className="block text-sm text-ink-2">
                      {lessonKindLabel[l.kind]} · {l.online ? "онлайн" : [l.room, l.building?.title].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </span>
              </RowLink>
            ))}
          </List>
        </Section>
      )}

      <Section title="Преподаватели">
        <List>
          {c.teachers.map((t, i) => (
            <RowLink key={t.id} href={`/teachers/${t.id}`}>
              <span className="flex items-center gap-3">
                <IconTile icon={UserRound} tone="neutral" />
                <span className="min-w-0">
                  <span className="block font-medium">{t.fullName}</span>
                  <span className="block text-sm text-ink-2">
                    {i === 0 ? "ведущий" : "ведёт часть занятий"}
                    {t.position && ` · ${t.position}`}
                  </span>
                </span>
              </span>
            </RowLink>
          ))}
        </List>
      </Section>

      <p className="px-1 text-xs text-ink-3">
        Шкала University (демо): 60 — E, 68 — D, 75 — C, 84 — B, 91 — A. Итоговая оценка выставляется на аттестации.
      </p>
    </>
  );
}
