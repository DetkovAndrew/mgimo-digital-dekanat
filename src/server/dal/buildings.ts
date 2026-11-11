import "server-only";
import { notFound } from "next/navigation";
import { addDays, mskStartOfDay } from "@/lib/format";
import { prisma } from "../db";
import { requireStudent } from "../session";

export const BUILDING_SCHEDULE_DAYS = 7;

/** Корпус (общие данные) и занятия ТЕКУЩЕГО студента в нём на ближайшие дни. */
export async function getBuilding(id: string) {
  const { groupId, studentId } = await requireStudent();
  const building = await prisma.building.findUnique({
    where: { id },
    select: { id: true, title: true, address: true, lat: true, lon: true, metro: true },
  });
  if (!building) notFound();

  const from = mskStartOfDay(new Date());
  const to = addDays(from, BUILDING_SCHEDULE_DAYS);
  const [lessons, sport] = await Promise.all([
    prisma.lesson.findMany({
      where: { buildingId: id, online: false, offering: { groupId }, startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        kind: true,
        startsAt: true,
        endsAt: true,
        room: true,
        status: true,
        offering: { select: { discipline: { select: { title: true } } } },
      },
    }),
    prisma.sportBooking.findMany({
      where: { studentId, status: "CONFIRMED", slot: { buildingId: id, startsAt: { gte: from, lt: to } } },
      select: { id: true, slot: { select: { startsAt: true, endsAt: true, room: true, section: { select: { title: true } } } } },
    }),
  ]);

  const visits = [
    ...lessons.map((l) => ({
      key: l.id,
      href: `/lessons/${l.id}`,
      title: l.offering.discipline.title,
      kind: l.kind as string,
      startsAt: l.startsAt,
      endsAt: l.endsAt,
      room: l.room,
      cancelled: l.status === "CANCELLED",
    })),
    ...sport.map((b) => ({
      key: `sport-${b.id}`,
      href: "/sport",
      title: `Физкультура: ${b.slot.section.title}`,
      kind: "SPORT",
      startsAt: b.slot.startsAt,
      endsAt: b.slot.endsAt,
      room: b.slot.room,
      cancelled: false,
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return { ...building, visits };
}
