import "server-only";
import { notFound } from "next/navigation";
import { addDays, mskStartOfDay } from "@/lib/format";
import { prisma } from "../db";
import { requireStudent } from "../session";

export const TEACHER_SCHEDULE_DAYS = 7;

/**
 * Публичный профиль преподавателя: видит любой вошедший студент (как расписание на сайте вуза).
 * Отдаём только время, дисциплину, тип, код группы, место и статус пары — без истории переносов,
 * оценок, списков студентов. Пары чужих групп приходят без id: открыть их нельзя.
 */
export async function getTeacher(id: string) {
  const { groupId } = await requireStudent();
  const teacher = await prisma.teacher.findUnique({ where: { id }, select: { id: true, fullName: true, position: true } });
  if (!teacher) notFound();

  const from = mskStartOfDay(new Date());
  const to = addDays(from, TEACHER_SCHEDULE_DAYS);
  const conducts = { OR: [{ teacherId: id }, { teacherId: null, offering: { leadTeacherId: id } }] };

  const [lessons, mine] = await Promise.all([
    prisma.lesson.findMany({
      where: { ...conducts, startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        kind: true,
        startsAt: true,
        endsAt: true,
        room: true,
        online: true,
        status: true,
        building: { select: { id: true, title: true } },
        offering: { select: { groupId: true, group: { select: { code: true } }, discipline: { select: { title: true } } } },
      },
    }),
    prisma.courseOffering.findMany({
      where: {
        groupId,
        term: { sessionEndsOn: { gte: from } },
        OR: [{ leadTeacherId: id }, { lessons: { some: { teacherId: id } } }],
      },
      orderBy: { discipline: { title: "asc" } },
      select: { id: true, leadTeacherId: true, discipline: { select: { title: true } } },
    }),
  ]);

  return {
    ...teacher,
    myCourses: mine.map((c) => ({ id: c.id, title: c.discipline.title, lead: c.leadTeacherId === id })),
    schedule: lessons.map((l) => {
      const isMine = l.offering.groupId === groupId;
      return {
        lessonId: isMine ? l.id : null,
        mine: isMine,
        kind: l.kind,
        startsAt: l.startsAt,
        endsAt: l.endsAt,
        room: l.room,
        online: l.online,
        status: l.status,
        building: l.building,
        title: l.offering.discipline.title,
        group: l.offering.group.code,
      };
    }),
  };
}

export type TeacherProfile = Awaited<ReturnType<typeof getTeacher>>;
