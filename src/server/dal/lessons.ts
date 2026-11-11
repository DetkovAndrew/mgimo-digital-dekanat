import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "../db";
import { requireStudent } from "../session";

const place = { select: { id: true, title: true, address: true, lat: true, lon: true, metro: true } } as const;

/** Пара группы текущего студента. Пара другой группы → 404. */
export async function getMyLesson(id: string) {
  const { groupId, studentId } = await requireStudent();
  const lesson = await prisma.lesson.findFirst({
    where: { id, offering: { groupId } },
    select: {
      id: true,
      kind: true,
      startsAt: true,
      endsAt: true,
      room: true,
      online: true,
      status: true,
      building: place,
      teacher: { select: { id: true, fullName: true, position: true } },
      offering: {
        select: {
          id: true,
          discipline: { select: { title: true } },
          leadTeacher: { select: { id: true, fullName: true, position: true } },
        },
      },
      changes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          previousStatus: true,
          newStatus: true,
          previousStartsAt: true,
          previousEndsAt: true,
          previousRoom: true,
          previousBuildingId: true,
          newStartsAt: true,
          newEndsAt: true,
          newRoom: true,
          newBuildingId: true,
          reason: true,
          createdAt: true,
        },
      },
    },
  });
  if (!lesson) notFound();

  const now = new Date();
  const buildingIds = [...new Set(lesson.changes.flatMap((c) => [c.previousBuildingId, c.newBuildingId]))].filter(
    (x): x is string => !!x,
  );
  const [next, deadlines, buildings] = await Promise.all([
    prisma.lesson.findFirst({
      where: { offeringId: lesson.offering.id, startsAt: { gt: lesson.startsAt }, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      select: { id: true, kind: true, startsAt: true, endsAt: true, room: true, online: true, building: { select: { title: true } } },
    }),
    prisma.assessment.findMany({
      where: {
        offeringId: lesson.offering.id,
        results: { none: { studentId } },
        OR: [{ dueAt: { gte: now } }, { dueAt: null, scheduledAt: { gte: now } }],
      },
      select: { id: true, title: true, dueAt: true, scheduledAt: true, maxPoints: true },
    }),
    prisma.building.findMany({ where: { id: { in: buildingIds } }, select: { id: true, title: true } }),
  ]);

  const { teacher, offering, ...rest } = lesson;
  return {
    ...rest,
    title: offering.discipline.title,
    offeringId: offering.id,
    teacher: teacher ?? offering.leadTeacher,
    next,
    // Сортировка по эффективной дате до ограничения: иначе экзамен (scheduledAt) уступал поздним работам.
    deadlines: deadlines
      .map((d) => ({ ...d, at: (d.dueAt ?? d.scheduledAt)! }))
      .sort((x, y) => x.at.getTime() - y.at.getTime())
      .slice(0, 2),
    buildingTitles: Object.fromEntries(buildings.map((b) => [b.id, b.title])) as Record<string, string>,
  };
}

export type MyLesson = Awaited<ReturnType<typeof getMyLesson>>;
