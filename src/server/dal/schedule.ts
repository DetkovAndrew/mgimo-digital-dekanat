import "server-only";
import { planFor, roomNumberFrom } from "@/lib/campus/plans";
import { mskStartOfDay } from "@/lib/format";
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
      teacher: { select: { id: true, fullName: true } },
      offering: {
        select: {
          id: true,
          discipline: { select: { title: true, shortTitle: true } },
          leadTeacher: { select: { id: true, fullName: true } },
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
    href: `/lessons/${l.id}`,
    offeringId: l.offering.id as string | null,
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
    teacherId: (l.teacher ?? l.offering.leadTeacher).id as string | null,
    change: (l.changes[0] ?? null) as (typeof l.changes)[number] | null,
  }));

  for (const b of sport) {
    items.push({
      id: `sport-${b.id}`,
      source: "sport",
      href: "/sport", // у тренировки пока нет своей страницы
      offeringId: null,
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
      teacherId: null, // тренер — пока строка, без профиля
      change: null,
    });
  }
  return items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export type ScheduleLesson = Awaited<ReturnType<typeof getMySchedule>>[number];

/**
 * Сколько занятий ещё впереди по каждой дисциплине семестра — только курсы группы студента, без отменённых
 * (опрос 15–16.11: «сколько занятий осталось до конца семестра по определённому предмету»). Для снимка помощника.
 */
export async function countMyRemainingLessons(offeringIds: string[], now = new Date()) {
  const { groupId } = await requireStudent();
  const rows = await prisma.lesson.groupBy({
    by: ["offeringId", "kind"],
    where: { offeringId: { in: offeringIds }, offering: { groupId }, startsAt: { gte: now }, status: { not: "CANCELLED" } },
    _count: { _all: true },
  });
  const out = new Map<string, { total: number; byKind: [kind: string, count: number][] }>();
  for (const r of rows) {
    const o = out.get(r.offeringId) ?? { total: 0, byKind: [] };
    o.total += r._count._all;
    o.byKind.push([r.kind, r._count._all]);
    out.set(r.offeringId, o);
  }
  return out;
}

/**
 * Откуда вести маршрут внутри корпуса (docs/plans/indoor-route.md): аудитория последнего занятия студента в этот день
 * (МСК), закончившегося не позже `before`. Отменённые и онлайн не в счёт. Если последнее такое занятие было в другом
 * корпусе или не в аудитории со схемы — null, маршрут начнётся от входа. Только из своего расписания (сессия).
 */
export async function getMyRouteStart(buildingId: string, before: Date): Promise<string | null> {
  const day = await getMySchedule({ from: mskStartOfDay(before), to: before });
  const last = day.filter((l) => l.status !== "CANCELLED" && !l.online && l.endsAt <= before).at(-1);
  if (!last || last.building?.id !== buildingId) return null;
  const number = roomNumberFrom(last.room);
  return number && planFor(buildingId)?.rooms.some((r) => r.number === number) ? number : null;
}
