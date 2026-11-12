// Начало маршрута внутри корпуса (docs/plans/indoor-route.md, ревью Codex 27): только из своего расписания.
import { afterAll, describe, expect, it, vi } from "vitest";
import { roomNumberFrom } from "@/lib/campus/plans";
import { prisma } from "@/server/db";
import { getMyRouteStart } from "@/server/dal/schedule";
import { actAs, makeStudent } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

afterAll(() => prisma.$disconnect());

describe("откуда вести маршрут", () => {
  it("A получает аудиторию своей прошлой пары в этом корпусе; в другом корпусе и у B без пар — от входа", async () => {
    const a = await actAs("alina.lebedeva");
    const lesson = await prisma.lesson.findFirstOrThrow({
      where: { offering: { groupId: a.groupId }, buildingId: { in: ["kronv", "lom-m"] }, online: false, status: { not: "CANCELLED" }, roomId: { not: null } },
      orderBy: { startsAt: "asc" },
    });
    const other = lesson.buildingId === "kronv" ? "lom-m" : "kronv";
    expect(await getMyRouteStart(lesson.buildingId!, lesson.endsAt)).toBe(roomNumberFrom(lesson.room));
    expect(await getMyRouteStart(other, lesson.endsAt)).toBeNull();
    // Самая ранняя пара группы: пока она идёт, прошлой пары в этот день нет — маршрут от входа.
    expect(await getMyRouteStart(lesson.buildingId!, new Date(lesson.endsAt.getTime() - 60_000))).toBeNull();

    await makeStudent(`route-b-${Date.now().toString(36)}`);
    expect(await getMyRouteStart(lesson.buildingId!, lesson.endsAt)).toBeNull();
  });
});
