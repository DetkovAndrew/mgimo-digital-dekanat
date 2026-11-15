import "server-only";
import { addDays } from "@/lib/format";
import { prisma } from "../db";
import { requireStudent } from "../session";
import { SPORT_RULES } from "./sport";

// Ачивки: только флаги «открыто», без самих оценок и баллов; считаются по данным владельца сессии.
// Открывают образы Инвиктии (src/lib/invictia/skins.ts).
export type Achievements = { excellent: boolean; sport60: boolean; sport100: boolean; booker: boolean; travel: boolean; invicta: boolean };

/** Сколько разных корпусов нужно для «Путешественницы». */
export const TRAVEL_BUILDINGS = 3;

export async function getMyAchievements(now = new Date()): Promise<Achievements> {
  const { studentId, groupId } = await requireStudent();
  const msk = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00+03:00`);

  const [term, sessions, bookings] = await Promise.all([
    prisma.academicTerm.findFirst({ where: { startsOn: { lte: now } }, orderBy: { startsOn: "desc" }, select: { id: true, startsOn: true, endsOn: true } }),
    // Две последние прошедшие сессии группы: последняя — для «отличника», обе — для «без пересдач за год».
    prisma.academicTerm.findMany({
      where: { sessionEndsOn: { lt: now }, offerings: { some: { groupId } } },
      orderBy: { sessionEndsOn: "desc" },
      take: 2,
      select: { id: true },
    }),
    prisma.roomBooking.count({ where: { studentId } }),
  ]);
  const lastSession = sessions[0];

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

  // Год без пересдач: в двух последних сессиях каждый экзамен и зачёт сдан с первой попытки.
  // Меньше двух прошедших сессий (первокурсник осенью) — ещё нет.
  let invicta = false;
  if (sessions.length === 2) {
    const yearFinals = await prisma.assessment.findMany({
      where: { kind: { in: ["EXAM", "CREDIT", "GRADED_CREDIT"] }, offering: { termId: { in: sessions.map((t) => t.id) }, groupId } },
      select: { results: { where: { studentId }, orderBy: { attempt: "desc" }, take: 1, select: { attempt: true, grade: true, passed: true } } },
    });
    invicta =
      yearFinals.length > 0 &&
      yearFinals.every((a) => {
        const r = a.results[0];
        return r !== undefined && r.attempt === 1 && (r.grade !== null ? r.grade >= 3 : r.passed === true);
      });
  }

  // Путешественница: занятия группы в этом семестре уже прошли в нескольких разных корпусах (не онлайн, не отменены).
  const buildings = term
    ? await prisma.lesson.findMany({
        where: { offering: { termId: term.id, groupId }, online: false, status: { not: "CANCELLED" }, startsAt: { lt: now }, buildingId: { not: null } },
        distinct: ["buildingId"],
        select: { buildingId: true },
      })
    : [];

  return {
    excellent,
    sport60: sport >= 60,
    sport100: sport >= SPORT_RULES.total,
    booker: bookings > 0,
    travel: buildings.length >= TRAVEL_BUILDINGS,
    invicta,
  };
}
