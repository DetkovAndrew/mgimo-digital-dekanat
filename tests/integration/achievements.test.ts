// Ачивки (открывают образы Инвиктии): только флаги и только по своим данным (A/B).
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { getMyAchievements } from "@/server/dal/achievements";
import { actAs, makeStudent } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

const tag = Date.now().toString(36);
afterAll(() => prisma.$disconnect());

describe("ачивки", () => {
  it("считаются по своим данным: бронь и баллы физкультуры B не открывают ничего у A, и наоборот", async () => {
    const b = await makeStudent(`ach-b-${tag}`);
    expect(await getMyAchievements()).toEqual({ excellent: false, sport60: false, sport100: false, booker: false, travel: false, invicta: false });

    const term = await prisma.academicTerm.findFirstOrThrow({ where: { startsOn: { lte: new Date() } }, orderBy: { startsOn: "desc" } });
    // Дополнительные баллы — не больше 40 за раз (CHECK в БД): 30 + 30 = 60.
    for (const points of [30, 30]) await prisma.sportExtraPoints.create({ data: { studentId: b.studentId, termId: term.id, title: "Тест", points, awardedAt: new Date() } });
    expect(await getMyAchievements()).toMatchObject({ sport60: true, sport100: false });
    await prisma.sportExtraPoints.create({ data: { studentId: b.studentId, termId: term.id, title: "Тест 2", points: 40, awardedAt: new Date() } });
    expect(await getMyAchievements()).toMatchObject({ sport60: true, sport100: true });

    const room = await prisma.room.findFirstOrThrow({ where: { bookable: true } });
    const start = new Date(Date.now() + 30 * 86_400_000);
    await prisma.roomBooking.create({ data: { roomId: room.id, studentId: b.studentId, startsAt: start, endsAt: new Date(start.getTime() + 3_600_000), purpose: "Ачивка" } });
    expect(await getMyAchievements()).toMatchObject({ booker: true });

    // Тимур без брони и с небольшими баллами: чужие баллы и бронь B ему не засчитываются.
    await actAs("timur.orlov");
    expect(await getMyAchievements()).toMatchObject({ sport60: false, sport100: false, booker: false });

    await prisma.roomBooking.deleteMany({ where: { studentId: b.studentId } });
    await prisma.sportExtraPoints.deleteMany({ where: { studentId: b.studentId } });
  });

  it("круглый отличник — только если все экзамены и зачёты с оценкой прошлой сессии закрыты на «5»", async () => {
    const a = await actAs("alina.lebedeva"); // в прошлой сессии у неё 4, 4, 3 и 5
    expect((await getMyAchievements()).excellent).toBe(false);

    const session = await prisma.academicTerm.findFirstOrThrow({ where: { sessionEndsOn: { lt: new Date() }, offerings: { some: { groupId: a.groupId } } }, orderBy: { sessionEndsOn: "desc" } });
    const finals = await prisma.gradeResult.findMany({
      where: { studentId: a.studentId, assessment: { kind: { in: ["EXAM", "GRADED_CREDIT"] }, offering: { termId: session.id, groupId: a.groupId } } },
    });
    try {
      // Все на «5» — Сова открыта.
      await prisma.gradeResult.updateMany({ where: { id: { in: finals.map((f) => f.id) } }, data: { grade: 5 } });
      expect((await getMyAchievements()).excellent).toBe(true);
      // Один экзамен без результата (не сдан) — уже не отличник.
      await prisma.gradeResult.delete({ where: { id: finals[0].id } });
      expect((await getMyAchievements()).excellent).toBe(false);
    } finally {
      await prisma.gradeResult.deleteMany({ where: { id: { in: finals.map((f) => f.id) } } });
      await prisma.gradeResult.createMany({ data: finals });
    }
  });

  it("«Непобедимая» — нужны итоги в каждой из двух последних сессий, все сданы с первой попытки", async () => {
    const a = await actAs("alina.lebedeva");
    const recent = await prisma.academicTerm.findFirstOrThrow({ where: { sessionEndsOn: { lt: new Date() }, offerings: { some: { groupId: a.groupId } } }, orderBy: { sessionEndsOn: "desc" } });
    const assessments = await prisma.assessment.findMany({
      where: { kind: { in: ["EXAM", "CREDIT", "GRADED_CREDIT"] }, offering: { termId: recent.id, groupId: a.groupId } },
      select: { id: true, kind: true },
    });
    const saved = await prisma.gradeResult.findMany({ where: { studentId: a.studentId, assessmentId: { in: assessments.map((x) => x.id) } } });
    // В сиде одна прошедшая сессия: добавляем группе более ранний семестр — сессия прошла, итогов в ней пока нет.
    const base = await prisma.courseOffering.findFirstOrThrow({ where: { termId: recent.id, groupId: a.groupId } });
    const old = await prisma.academicTerm.create({
      data: { title: `Тест ${tag}`, startsOn: new Date("2025-09-01"), endsOn: new Date("2025-12-31"), sessionStartsOn: new Date("2026-01-09"), sessionEndsOn: new Date("2026-01-31") },
    });
    const offering = await prisma.courseOffering.create({
      data: { disciplineId: base.disciplineId, groupId: a.groupId, termId: old.id, leadTeacherId: base.leadTeacherId, controlForm: base.controlForm, credits: 3 },
    });
    try {
      // Последняя сессия сдана с первой попытки целиком.
      await prisma.gradeResult.deleteMany({ where: { id: { in: saved.map((r) => r.id) } } });
      await prisma.gradeResult.createMany({
        data: assessments.map((x) => ({ studentId: a.studentId, assessmentId: x.id, attempt: 1, gradedAt: new Date(), ...(x.kind === "CREDIT" ? { passed: true } : { grade: 5 }) })),
      });
      // В ранней сессии итогов нет — одной сессии мало.
      expect((await getMyAchievements()).invicta).toBe(false);
      // Экзамен ранней сессии сдан с первой попытки — открыта.
      const exam = await prisma.assessment.create({ data: { offeringId: offering.id, kind: "EXAM", title: "Экзамен" } });
      await prisma.gradeResult.create({ data: { studentId: a.studentId, assessmentId: exam.id, attempt: 1, grade: 4, gradedAt: new Date() } });
      expect((await getMyAchievements()).invicta).toBe(true);
      // Тот же экзамен со второй попытки — пересдача, закрыта.
      await prisma.gradeResult.create({ data: { studentId: a.studentId, assessmentId: exam.id, attempt: 2, grade: 5, gradedAt: new Date() } });
      expect((await getMyAchievements()).invicta).toBe(false);
    } finally {
      await prisma.courseOffering.delete({ where: { id: offering.id } }); // аттестации и результаты — каскадом
      await prisma.academicTerm.delete({ where: { id: old.id } });
      await prisma.gradeResult.deleteMany({ where: { studentId: a.studentId, assessmentId: { in: assessments.map((x) => x.id) } } });
      await prisma.gradeResult.createMany({ data: saved });
    }
  });
});
