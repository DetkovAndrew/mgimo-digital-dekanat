// Остаток занятий по предметам (для помощника): только курсы своей группы, без отменённых и прошедших.
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { buildMyContext } from "@/server/ai/context";
import { countMyRemainingLessons } from "@/server/dal/schedule";
import { actAs } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

afterAll(() => prisma.$disconnect());

describe("остаток занятий", () => {
  it("считает только будущие неотменённые занятия своих курсов; чужие курсы — пусто", async () => {
    const a = await actAs("alina.lebedeva");
    const b = await actAs("timur.orlov");
    expect(a.groupId).not.toBe(b.groupId);
    await actAs("alina.lebedeva");
    const now = new Date();
    const mine = await prisma.courseOffering.findMany({ where: { groupId: a.groupId }, select: { id: true } });
    const theirs = await prisma.courseOffering.findMany({ where: { groupId: b.groupId }, select: { id: true } });

    const got = await countMyRemainingLessons(mine.map((o) => o.id), now);
    const expected = await prisma.lesson.count({ where: { offering: { groupId: a.groupId }, startsAt: { gte: now }, status: { not: "CANCELLED" } } });
    expect(expected).toBeGreaterThan(0); // проверка не «впустую»
    expect([...got.values()].reduce((s, x) => s + x.total, 0)).toBe(expected);

    // Подставили курсы Тимура — Алине ничего не отдаётся.
    expect((await countMyRemainingLessons(theirs.map((o) => o.id), now)).size).toBe(0);
  });

  it("в снимке помощника — остаток по предметам и сроки на 3 недели, снимок не обрезан", async () => {
    await actAs("alina.lebedeva");
    const { text } = await buildMyContext();
    expect(text).toMatch(/осталось занятий до конца семестра: \d+|занятий до конца семестра больше нет/);
    expect(text).toContain("## Сроки работ на 3 недели");
    expect(text).not.toContain("снимок обрезан");
  });
});
