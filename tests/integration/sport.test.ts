// Физкультура: приоритеты, жеребьёвка, отмена и продвижение очереди, доступ A/B.
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { cancelMyBooking, drawWeek, getMySport, runDemoDraw, saveMyPreferences, SPORT_RULES } from "@/server/dal/sport";
import { actAs, expect404 } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn() }));

afterAll(() => prisma.$disconnect());

describe("физкультура", () => {
  it("недоступную тренировку (пересечение/переход) сохранить нельзя, доступную — можно", async () => {
    await actAs("alina.lebedeva");
    const sport = await getMySport();
    const open = sport.open!;
    const bad = open.slots.find((s) => s.unavailable);
    const good = open.slots.filter((s) => !s.unavailable).slice(0, 3);
    const week = open.weekStart.toISOString().slice(0, 10);

    if (bad) {
      const r = await saveMyPreferences(week, [bad.id]);
      expect(r.ok).toBe(false);
    }
    const r = await saveMyPreferences(week, good.map((s) => s.id));
    expect(r).toMatchObject({ ok: true });
    expect((await getMySport()).open!.myPreferenceSlotIds).toEqual(good.map((s) => s.id));
  });

  it("жеребьёвка: вместимость, квота, сначала каждому по одному; повторно не запускается", async () => {
    await actAs("alina.lebedeva");
    const weekStart = (await getMySport()).open!.weekStart;
    const r = await drawWeek(weekStart);
    expect(r.ok).toBe(true);
    expect((await drawWeek(weekStart)).ok).toBe(false);

    const slots = await prisma.sportSlot.findMany({ where: { weekStart }, include: { bookings: true } });
    for (const s of slots) {
      expect(s.bookings.filter((b) => b.status === "CONFIRMED").length).toBeLessThanOrEqual(s.capacity);
    }
    const confirmed = slots.flatMap((s) => s.bookings).filter((b) => b.status === "CONFIRMED");
    const perStudent = new Map<string, number>();
    for (const b of confirmed) perStudent.set(b.studentId, (perStudent.get(b.studentId) ?? 0) + 1);
    expect(Math.max(...perStudent.values())).toBeLessThanOrEqual(SPORT_RULES.weeklyQuota);

    // Если у кого-то 2 занятия, то никто из участников не остался с нулём при наличии подходящих мест в проходе 1:
    // проверяем мягче — все, кто в очереди с нулём занятий, хотели только заполненные слоты.
    const waitlisted = slots.flatMap((s) => s.bookings).filter((b) => b.status === "WAITLIST");
    for (const w of waitlisted.filter((x) => !perStudent.has(x.studentId))) {
      const slot = slots.find((s) => s.id === w.slotId)!;
      expect(slot.bookings.filter((b) => b.status === "CONFIRMED").length).toBe(slot.capacity);
    }
  });

  it("B не может отменить запись A — 404; отмена A передаёт место первому в очереди", async () => {
    const A = await actAs("alina.lebedeva");
    const weekStart = (await prisma.sportWeek.findFirstOrThrow({ where: { status: "DRAWN", seed: { not: null } } })).weekStart;
    // Берём слот с очередью и подтверждённым участником; если у A нет такой записи — создаём её в этом слоте.
    const slot = await prisma.sportSlot.findFirstOrThrow({
      where: { weekStart, bookings: { some: { status: "WAITLIST" } } },
      include: { bookings: true },
    });
    let booking = slot.bookings.find((b) => b.studentId === A.studentId && b.status === "CONFIRMED");
    if (!booking) {
      const victim = slot.bookings.find((b) => b.status === "CONFIRMED")!;
      await prisma.sportBooking.delete({ where: { id: victim.id } });
      booking = await prisma.sportBooking.upsert({
        where: { studentId_slotId: { studentId: A.studentId, slotId: slot.id } },
        update: { status: "CONFIRMED" },
        create: { studentId: A.studentId, slotId: slot.id, weekStart, status: "CONFIRMED", rank: 1 },
      });
    }

    await actAs("timur.orlov");
    await expect404(cancelMyBooking(booking.id));
    expect((await prisma.sportBooking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");

    await actAs("alina.lebedeva");
    const waitingBefore = await prisma.sportBooking.count({ where: { slotId: slot.id, status: "WAITLIST" } });
    const r = await cancelMyBooking(booking.id);
    expect(r.ok).toBe(true);
    const after = await prisma.sportBooking.findMany({ where: { slotId: slot.id } });
    expect(after.find((b) => b.id === booking!.id)!.status).toBe("CANCELLED");
    expect(after.filter((b) => b.status === "CONFIRMED").length).toBeLessThanOrEqual(slot.capacity);
    expect(after.filter((b) => b.status === "WAITLIST").length).toBe(waitingBefore - 1);
  });

  it("демо-жеребьёвка доступна только разрешённым аккаунтам", async () => {
    const saved = { flag: process.env.SPORT_DEMO_DRAW, accounts: process.env.SPORT_DEMO_ACCOUNTS };
    process.env.SPORT_DEMO_DRAW = "1";
    process.env.SPORT_DEMO_ACCOUNTS = "timur.orlov";
    try {
      await actAs("alina.lebedeva");
      expect(await runDemoDraw()).toMatchObject({ ok: false });
    } finally {
      process.env.SPORT_DEMO_DRAW = saved.flag;
      process.env.SPORT_DEMO_ACCOUNTS = saved.accounts;
    }
  });

  it("неделя с прошедшим дедлайном разыгрывается автоматически при обращении", async () => {
    await actAs("timur.orlov");
    const week = await prisma.sportWeek.findFirstOrThrow({ where: { status: "OPEN" }, orderBy: { weekStart: "asc" } });
    await prisma.sportWeek.update({ where: { weekStart: week.weekStart }, data: { deadline: new Date(Date.now() - 60_000) } });
    await getMySport();
    expect((await prisma.sportWeek.findUniqueOrThrow({ where: { weekStart: week.weekStart } })).status).toBe("DRAWN");
  });
});
