import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "../db";
import { requireStudent } from "../session";

/** Дисциплина группы текущего студента с ЕГО результатами. Дисциплина другой группы → 404. */
export async function getMyCourse(id: string) {
  const { groupId, studentId } = await requireStudent();
  const course = await prisma.courseOffering.findFirst({
    where: { id, groupId },
    select: {
      id: true,
      controlForm: true,
      credits: true,
      discipline: { select: { title: true } },
      term: { select: { title: true, sessionStartsOn: true, sessionEndsOn: true } },
      leadTeacher: { select: { id: true, fullName: true, position: true } },
      assessments: {
        orderBy: [{ scheduledAt: "asc" }, { dueAt: "asc" }],
        select: {
          id: true,
          kind: true,
          title: true,
          scheduledAt: true,
          dueAt: true,
          maxPoints: true,
          room: true,
          results: {
            where: { studentId },
            orderBy: { attempt: "asc" },
            select: { attempt: true, grade: true, passed: true, points: true, comment: true },
          },
        },
      },
    },
  });
  if (!course) notFound();

  const [upcoming, teachers] = await Promise.all([
    prisma.lesson.findMany({
      where: { offeringId: id, endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 3,
      select: {
        id: true,
        kind: true,
        startsAt: true,
        endsAt: true,
        room: true,
        online: true,
        status: true,
        building: { select: { title: true } },
      },
    }),
    prisma.lesson.findMany({
      where: { offeringId: id, teacherId: { not: null } },
      distinct: ["teacherId"],
      select: { teacher: { select: { id: true, fullName: true, position: true } } },
    }),
  ]);

  const others = teachers.map((t) => t.teacher!).filter((t) => t.id !== course.leadTeacher.id);
  return { ...course, upcoming, teachers: [course.leadTeacher, ...others] };
}

export type MyCourse = Awaited<ReturnType<typeof getMyCourse>>;
