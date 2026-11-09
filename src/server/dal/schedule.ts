import "server-only";
import { prisma } from "../db";
import { requireStudent } from "../session";

/** Занятия группы текущего студента в полуинтервале [from, to). */
export async function getMySchedule(range: { from: Date; to: Date }) {
  const { groupId } = await requireStudent();
  const lessons = await prisma.lesson.findMany({
    where: { offering: { groupId }, startsAt: { gte: range.from, lt: range.to } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      kind: true,
      startsAt: true,
      endsAt: true,
      room: true,
      online: true,
      status: true,
      building: { select: { id: true, title: true, address: true, lat: true, lon: true, metro: true } },
      teacher: { select: { fullName: true } },
      offering: {
        select: {
          discipline: { select: { title: true, shortTitle: true } },
          leadTeacher: { select: { fullName: true } },
        },
      },
      changes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          previousStartsAt: true,
          previousEndsAt: true,
          previousRoom: true,
          previousBuildingId: true,
          reason: true,
          createdAt: true,
        },
      },
    },
  });

  return lessons.map((l) => ({
    id: l.id,
    kind: l.kind,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    room: l.room,
    online: l.online,
    status: l.status,
    building: l.building,
    title: l.offering.discipline.title,
    shortTitle: l.offering.discipline.shortTitle ?? l.offering.discipline.title,
    teacher: (l.teacher ?? l.offering.leadTeacher).fullName,
    change: l.changes[0] ?? null,
  }));
}

export type ScheduleLesson = Awaited<ReturnType<typeof getMySchedule>>[number];
