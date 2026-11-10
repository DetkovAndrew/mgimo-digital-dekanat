import { describe, expect, it } from "vitest";
import { transfersForDay } from "./transfers";

const lom = { id: "lom-m", lat: 59.92729, lon: 30.33835, title: "Ломоносова, 9" };
const grivc = { id: "grivc", lat: 59.92953, lon: 30.31506, title: "Гривцова, 14" };
const at = (h: string) => new Date(`2026-11-10T${h}:00+03:00`);
const lesson = (id: string, s: string, e: string, building: typeof lom | null, status = "SCHEDULED") => ({
  id,
  startsAt: at(s),
  endsAt: at(e),
  status,
  online: false,
  building,
});

describe("переходы за день", () => {
  it("Ломоносова → Гривцова за 10 минут — не успеть", () => {
    const t = transfersForDay([lesson("1", "08:10", "09:40", lom), lesson("2", "09:50", "11:20", grivc)]);
    expect(t.get("1")?.verdict.kind).toBe("impossible");
  });

  it("отменённая пара не участвует", () => {
    const t = transfersForDay([
      lesson("1", "08:10", "09:40", lom),
      lesson("2", "09:50", "11:20", grivc, "CANCELLED"),
    ]);
    expect(t.size).toBe(0);
  });

  it("онлайн-пара не создаёт перехода", () => {
    const t = transfersForDay([lesson("1", "08:10", "09:40", lom), lesson("2", "09:50", "11:20", null)]);
    expect(t.size).toBe(0);
  });

  it("онлайн-пара с сохранённым корпусом тоже не создаёт перехода", () => {
    const online = { ...lesson("2", "09:50", "11:20", grivc), online: true };
    expect(transfersForDay([lesson("1", "08:10", "09:40", lom), online]).size).toBe(0);
  });
});
