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
          leadTeacher: { select: { fullName: true } },
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
