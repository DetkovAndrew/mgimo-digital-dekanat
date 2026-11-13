// События учёбы в календаре расписания (ревью Codex 40): только своя группа, итог по последней попытке.
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { getMyStudyEvents } from "@/server/dal/grades";
import { actAs, makeStudent } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));
afterAll(() => prisma.$disconnect());

const year = { from: new Date("2025-09-01T00:00:00+03:00"), to: new Date("2027-09-01T00:00:00+03:00") };

describe("события учёбы", () => {
  it("видны только события своей группы; экзамен с двойкой — «не сдано», с тройкой — «сдано»", async () => {
    const a = await actAs("alina.lebedeva");
    const mine = await getMyStudyEvents(year);
    expect(mine.length).toBeGreaterThan(0);
    const offerings = new Set((await prisma.courseOffering.findMany({ where: { groupId: a.groupId }, select: { id: true } })).map((o) => o.id));
    expect(mine.every((e) => offerings.has(e.offeringId))).toBe(true);

    const exam = mine.find((e) => e.kind === "EXAM" && e.result)!;
    const last = await prisma.gradeResult.findFirstOrThrow({ where: { studentId: a.studentId, assessmentId: exam.id }, orderBy: { attempt: "desc" } });
    try {
      await prisma.gradeResult.update({ where: { id: last.id }, data: { grade: 2, passed: null } });
      expect((await getMyStudyEvents(year)).find((e) => e.id === exam.id)!.result).toBe("failed");
      await prisma.gradeResult.update({ where: { id: last.id }, data: { grade: 3 } });
      expect((await getMyStudyEvents(year)).find((e) => e.id === exam.id)!.result).toBe("passed");
    } finally {
      await prisma.gradeResult.update({ where: { id: last.id }, data: { grade: last.grade, passed: last.passed } });
    }

    // Студент другой группы (без дисциплин) не видит событий группы Алины.
    await makeStudent(`events-b-${Date.now().toString(36)}`);
    expect(await getMyStudyEvents(year)).toEqual([]);
  });
});
