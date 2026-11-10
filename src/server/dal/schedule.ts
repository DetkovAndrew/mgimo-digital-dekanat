import "server-only";
import { prisma } from "../db";
import { requireStudent } from "../session";

/** Занятия группы текущего студента и его тренировки в полуинтервале [from, to). */
export async function getMySchedule(range: { from: Date; to: Date }) {
  const { groupId, studentId } = await requireStudent();
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

  // Подтверждённые тренировки студента — в общее расписание (с маршрутами и переходами).
  const sport = await prisma.sportBooking.findMany({
    where: { studentId, status: { in: ["CONFIRMED", "ATTENDED", "MISSED"] }, slot: { startsAt: { gte: range.from, lt: range.to } } },
    select: {
      id: true,
      status: true,
      slot: {
        select: {
          startsAt: true,
          endsAt: true,
          room: true,
          coach: true,
          section: { select: { title: true } },
          building: { select: { id: true, title: true, address: true, lat: true, lon: true, metro: true } },
        },
      },
    },
  });

  const items = lessons.map((l) => ({
    id: l.id,
    source: "lesson" as "lesson" | "sport",
    kind: l.kind as string,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    room: l.room,
    online: l.online,
    status: l.status as string,
    building: l.building,
    title: l.offering.discipline.title,
    shortTitle: l.offering.discipline.shortTitle ?? l.offering.discipline.title,
    teacher: (l.teacher ?? l.offering.leadTeacher).fullName,
    change: (l.changes[0] ?? null) as (typeof l.changes)[number] | null,
  }));

  for (const b of sport) {
    items.push({
      id: `sport-${b.id}`,
      source: "sport",
      kind: "SPORT",
      startsAt: b.slot.startsAt,
      endsAt: b.slot.endsAt,
      room: b.slot.room,
      online: false,
      status: "SCHEDULED",
      building: b.slot.building,
      title: `Физкультура: ${b.slot.section.title}`,
      shortTitle: b.slot.section.title,
      teacher: b.slot.coach,
      change: null,
    });
  }
  return items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export type ScheduleLesson = Awaited<ReturnType<typeof getMySchedule>>[number];
