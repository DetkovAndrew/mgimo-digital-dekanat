import "server-only";
import { prisma } from "../db";
import { requireStudent } from "../session";

/** Дисциплины группы студента по семестрам и ЕГО результаты (чужие результаты не выбираются). */
export async function getMyGrades() {
  const { studentId, groupId } = await requireStudent();
  return prisma.academicTerm.findMany({
    where: { offerings: { some: { groupId } } },
    orderBy: { startsOn: "desc" },
    select: {
      id: true,
      title: true,
      sessionStartsOn: true,
      sessionEndsOn: true,
      offerings: {
        where: { groupId },
        orderBy: { discipline: { title: "asc" } },
        select: {
          id: true,
          controlForm: true,
          credits: true,
          discipline: { select: { title: true } },
          leadTeacher: { select: { id: true, fullName: true } },
          assessments: {
            orderBy: [{ scheduledAt: "asc" }, { dueAt: "asc" }],
            select: {
              id: true,
              kind: true,
              title: true,
              scheduledAt: true,
              dueAt: true,
              maxPoints: true,
              results: {
                where: { studentId },
                orderBy: { attempt: "asc" },
                select: { attempt: true, grade: true, passed: true, points: true, comment: true },
              },
            },
          },
        },
      },
    },
  });
}

export type MyTerm = Awaited<ReturnType<typeof getMyGrades>>[number];

/** Ближайшие сроки: неоценённые у ЭТОГО студента контрольные точки и аттестации его группы. */
export async function getMyUpcomingDeadlines(range: { from: Date; to: Date }) {
  const { studentId, groupId } = await requireStudent();
  const rows = await prisma.assessment.findMany({
    where: {
      offering: { groupId },
      results: { none: { studentId } },
      // Эффективная дата — dueAt, а при его отсутствии scheduledAt (то же правило, что при выводе).
      OR: [
        { dueAt: { gte: range.from, lt: range.to } },
        { dueAt: null, scheduledAt: { gte: range.from, lt: range.to } },
      ],
    },
    select: {
      id: true,
      kind: true,
      title: true,
      dueAt: true,
      scheduledAt: true,
      maxPoints: true,
      offering: { select: { id: true, discipline: { select: { title: true, shortTitle: true } } } },
    },
  });
  return rows
    .map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      at: (a.dueAt ?? a.scheduledAt)!,
      maxPoints: a.maxPoints,
      offeringId: a.offering.id,
      discipline: a.offering.discipline.shortTitle ?? a.offering.discipline.title,
    }))
    .sort((x, y) => x.at.getTime() - y.at.getTime());
}
