import { describe, expect, it } from "vitest";
import { allocate, lotteryOrder, type PreferenceInput, type SlotInput } from "./allocate";

const slot = (id: string, day: string, capacity: number, from = "10:00", to = "11:30"): SlotInput => ({
  id,
  capacity,
  startsAt: new Date(`2026-11-${day}T${from}:00+03:00`),
  endsAt: new Date(`2026-11-${day}T${to}:00+03:00`),
});

const base = {
  seed: "week-2026-11-16",
  weeklyQuota: 2,
  unavailableReason: () => null,
};

describe("жеребьёвка", () => {
  it("не превышает вместимость и квоту", () => {
    const slots = [slot("mon", "16", 2), slot("tue", "17", 1), slot("wed", "18", 2)];
    const preferences: PreferenceInput[] = ["a", "b", "c", "d"].flatMap((s) => [
      { studentId: s, slotId: "mon", rank: 1 },
      { studentId: s, slotId: "tue", rank: 2 },
      { studentId: s, slotId: "wed", rank: 3 },
    ]);
    const { assignments } = allocate({ ...base, slots, preferences });
    const confirmed = assignments.filter((a) => a.status === "CONFIRMED");
    for (const s of slots) {
      expect(confirmed.filter((a) => a.slotId === s.id).length).toBeLessThanOrEqual(s.capacity);
    }
    for (const st of ["a", "b", "c", "d"]) {
      expect(confirmed.filter((a) => a.studentId === st).length).toBeLessThanOrEqual(2);
    }
  });

  it("сначала каждому по одному занятию, потом вторые", () => {
    // 3 места на всю неделю, 3 студента хотят по 2 занятия: каждый получает ровно одно.
    const slots = [slot("mon", "16", 2), slot("wed", "18", 1)];
    const preferences: PreferenceInput[] = ["a", "b", "c"].flatMap((s) => [
      { studentId: s, slotId: "mon", rank: 1 },
      { studentId: s, slotId: "wed", rank: 2 },
    ]);
    const { assignments } = allocate({ ...base, slots, preferences });
    const perStudent = ["a", "b", "c"].map((s) => assignments.filter((a) => a.studentId === s && a.status === "CONFIRMED").length);
    expect(perStudent).toEqual([1, 1, 1]);
  });

  it("результат не зависит от порядка подачи приоритетов", () => {
    const slots = [slot("mon", "16", 1), slot("tue", "17", 1)];
    const preferences: PreferenceInput[] = ["a", "b", "c"].flatMap((s) => [
      { studentId: s, slotId: "mon", rank: 1 },
      { studentId: s, slotId: "tue", rank: 2 },
    ]);
    const one = allocate({ ...base, slots, preferences }).assignments;
    const two = allocate({ ...base, slots, preferences: [...preferences].reverse() }).assignments;
    const key = (xs: typeof one) => xs.map((a) => `${a.studentId}:${a.slotId}:${a.status}:${a.position ?? ""}`).sort();
    expect(key(two)).toEqual(key(one));
  });

  it("разный seed — разный порядок, один seed — один и тот же", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `s${i}`);
    expect(lotteryOrder(ids, "x")).toEqual(lotteryOrder([...ids].reverse(), "x"));
    expect(lotteryOrder(ids, "x")).not.toEqual(lotteryOrder(ids, "y"));
  });

  it("недоступный слот пропускается и объясняется", () => {
    const slots = [slot("mon", "16", 5), slot("tue", "17", 5)];
    const preferences: PreferenceInput[] = [
      { studentId: "a", slotId: "mon", rank: 1 },
      { studentId: "a", slotId: "tue", rank: 2 },
    ];
    const { assignments } = allocate({
      ...base,
      weeklyQuota: 1,
      slots,
      preferences,
      unavailableReason: (_s, slotId) => (slotId === "mon" ? "пересечение с парой" : null),
    });
    expect(assignments).toEqual([
      expect.objectContaining({ slotId: "tue", status: "CONFIRMED", explanation: "2-й выбор (1-й: пересечение с парой)" }),
    ]);
  });

  it("не даёт два занятия в один день", () => {
    const slots = [slot("am", "16", 5, "10:00", "11:30"), slot("pm", "16", 5, "15:00", "16:30")];
    const preferences: PreferenceInput[] = [
      { studentId: "a", slotId: "am", rank: 1 },
      { studentId: "a", slotId: "pm", rank: 2 },
    ];
    const confirmed = allocate({ ...base, slots, preferences }).assignments.filter((a) => a.status === "CONFIRMED");
    expect(confirmed.map((a) => a.slotId)).toEqual(["am"]);
  });

  it("лист ожидания: позиции по порядку жеребьёвки, без тех, кто добрал квоту", () => {
    const slots = [slot("mon", "16", 1)];
    const preferences: PreferenceInput[] = ["a", "b", "c"].map((s) => ({ studentId: s, slotId: "mon", rank: 1 }));
    const { order, assignments } = allocate({ ...base, weeklyQuota: 1, slots, preferences });
    const waitlist = assignments.filter((a) => a.status === "WAITLIST");
    expect(waitlist.map((a) => a.studentId)).toEqual(order.slice(1));
    expect(waitlist.map((a) => a.position)).toEqual([1, 2]);
  });
});
