import "server-only";
import { addDays } from "@/lib/format";
import { prisma } from "../db";
import { requireStudent } from "../session";
import { SPORT_RULES } from "./sport";

// Ачивки: только флаги «открыто», без самих оценок и баллов; считаются по данным владельца сессии.
// Раньше открывали попутчиков на маршруте (убраны 15.11); на них же будут открываться образы Инвиктии.
export type Achievements = { excellent: boolean; sport60: boolean; sport100: boolean; booker: boolean };

export async function getMyAchievements(now = new Date()): Promise<Achievements> {
  const { studentId, groupId } = await requireStudent();
  const msk = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00+03:00`);

  const [term, lastSession, bookings] = await Promise.all([
    prisma.academicTerm.findFirst({ where: { startsOn: { lte: now } }, orderBy: { startsOn: "desc" }, select: { id: true, startsOn: true, endsOn: true } }),
    prisma.academicTerm.findFirst({
      where: { sessionEndsOn: { lt: now }, offerings: { some: { groupId } } },
      orderBy: { sessionEndsOn: "desc" },
      select: { id: true },
    }),
    prisma.roomBooking.count({ where: { studentId } }),
  ]);

  // Физкультура за текущий семестр: тренировки × баллы + дополнительные баллы (как на странице «Спорт»).
  let sport = 0;
  if (term) {
    const [attended, extra] = await Promise.all([
      prisma.sportBooking.count({ where: { studentId, status: "ATTENDED", slot: { startsAt: { gte: msk(term.startsOn), lt: addDays(msk(term.endsOn), 1) } } } }),
      prisma.sportExtraPoints.aggregate({ where: { studentId, termId: term.id }, _sum: { points: true } }),
    ]);
    sport = Math.min(SPORT_RULES.total, attended * SPORT_RULES.pointsPerTraining + (extra._sum.points ?? 0));
  }

  // Круглый отличник: в последнюю прошедшую сессию ВСЕ экзамены и зачёты с оценкой группы закрыты на «5»
  // (по последней попытке). Нет результата хотя бы по одному — не отличник.
  const finals = lastSession
    ? await prisma.assessment.findMany({
        where: { kind: { in: ["EXAM", "GRADED_CREDIT"] }, offering: { termId: lastSession.id, groupId } },
        select: { results: { where: { studentId }, orderBy: { attempt: "desc" }, take: 1, select: { grade: true } } },
      })
    : [];
  const excellent = finals.length > 0 && finals.every((a) => a.results[0]?.grade === 5);

  return { excellent, sport60: sport >= 60, sport100: sport >= SPORT_RULES.total, booker: bookings > 0 };
}
