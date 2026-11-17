// Образы Инвиктии: выбрать можно только открытый образ и только себе; закрывшийся образ показывается базовым.
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { getMySkinId, getMyWardrobe, setMySkin } from "@/server/dal/skins";
import { actAs, makeStudent } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

const tag = Date.now().toString(36);
afterAll(() => prisma.$disconnect());

describe("образы Инвиктии", () => {
  it("закрытый образ не выбрать; после брони аудитории — можно, и только себе", async () => {
    const timur = await actAs("timur.orlov");
    const timurBefore = (await prisma.studentProfile.findUniqueOrThrow({ where: { id: timur.studentId } })).invictiaSkin;

    const b = await makeStudent(`skin-b-${tag}`);
    expect(await getMyWardrobe()).toEqual({ current: "base", unlocked: ["base"] });
    expect(await setMySkin("cat")).toEqual({ ok: false, error: "Этот образ ещё не открыт" });
    expect(await setMySkin("newyear")).toEqual({ ok: false, error: "Этот образ ещё не открыт" }); // сезонные в прототипе закрыты
    expect(await setMySkin("../admin")).toEqual({ ok: false, error: "Такого образа нет" });
    expect(await setMySkin({ id: "cat" })).toEqual({ ok: false, error: "Такого образа нет" });
    expect((await prisma.studentProfile.findUniqueOrThrow({ where: { id: b.studentId } })).invictiaSkin).toBeNull();

    const room = await prisma.room.findFirstOrThrow({ where: { bookable: true } });
    const start = new Date(Date.now() + 40 * 86_400_000);
    const booking = await prisma.roomBooking.create({ data: { roomId: room.id, studentId: b.studentId, startsAt: start, endsAt: new Date(start.getTime() + 3_600_000), purpose: "Образ" } });
    try {
      expect(await setMySkin("cat")).toEqual({ ok: true });
      expect(await getMySkinId()).toBe("cat");
      expect(await getMyWardrobe()).toMatchObject({ current: "cat", unlocked: expect.arrayContaining(["base", "cat"]) });
      // Чужой профиль не тронут.
      expect((await prisma.studentProfile.findUniqueOrThrow({ where: { id: timur.studentId } })).invictiaSkin).toBe(timurBefore);

      // Брони больше нет — образ закрылся: в гардеробе и на кнопке помощника базовый, хотя в профиле ещё записан cat.
      await prisma.roomBooking.delete({ where: { id: booking.id } });
      expect((await getMyWardrobe()).current).toBe("base");
      expect(await getMySkinId()).toBe("base");
      expect((await prisma.studentProfile.findUniqueOrThrow({ where: { id: b.studentId } })).invictiaSkin).toBe("cat");
      // Базовый снимает образ: в профиле снова null.
      expect(await setMySkin("base")).toEqual({ ok: true });
      expect((await prisma.studentProfile.findUniqueOrThrow({ where: { id: b.studentId } })).invictiaSkin).toBeNull();
    } finally {
      await prisma.roomBooking.deleteMany({ where: { studentId: b.studentId } });
    }
  });

  it("в базу не записать произвольную строку в обход сервера (CHECK)", async () => {
    const t = await actAs("timur.orlov");
    await expect(prisma.studentProfile.update({ where: { id: t.studentId }, data: { invictiaSkin: "<script>" } })).rejects.toThrow();
  });
});
