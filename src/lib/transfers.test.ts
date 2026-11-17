import { describe, expect, it } from "vitest";
import { transfersForDay, transferText } from "./transfers";

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

describe("тот же корпус и текст перехода", () => {
  it("пара в том же корпусе — только по запросу и с посчитанным перерывом", () => {
    const day = [lesson("1", "08:10", "09:40", lom), lesson("2", "09:50", "11:20", lom)];
    expect(transfersForDay(day).size).toBe(0);
    const t = transfersForDay(day, { sameBuilding: true }).get("1");
    expect(t?.verdict).toEqual({ kind: "same-building", gapMin: 10 });
    expect(transferText(t!.verdict)).toBe("Тот же корпус, перерыв 10 мин.");
  });

  it("текст: не успеть, впритык и успеваете — с перерывом и дорогой", () => {
    const far = transfersForDay([lesson("1", "08:10", "09:40", lom), lesson("2", "09:50", "11:20", grivc)]).get("1")!;
    expect(transferText(far.verdict)).toMatch(/^Не успеть: перерыв 10 мин, а дорога ≈ \d+ мин/);
    const roomy = transfersForDay([lesson("1", "08:10", "09:40", lom), lesson("2", "11:00", "12:30", grivc)]).get("1")!;
    expect(roomy.verdict.kind).toBe("ok");
    expect(transferText(roomy.verdict)).toMatch(/перерыв 80 мин\.$/);
  });
});

describe("онлайн-пара между очными", () => {
  it("перерыв считается от её конца, а идти — из последнего очного корпуса", () => {
    const online = { ...lesson("2", "09:50", "11:20", null), online: true };
    const t = transfersForDay([lesson("1", "08:10", "09:40", lom), online, lesson("3", "11:30", "13:00", grivc)]);
    expect(t.has("1")).toBe(false);
    expect(t.get("2")?.verdict).toMatchObject({ kind: "impossible", gapMin: 10 });
    expect(t.get("2")?.toTitle).toBe("Гривцова, 14");
  });

  it("онлайн-пара в начале дня не даёт перехода: откуда идти, неизвестно", () => {
    const online = { ...lesson("1", "08:10", "09:40", null), online: true };
    expect(transfersForDay([online, lesson("2", "09:50", "11:20", grivc)]).size).toBe(0);
  });

  it("тот же корпус без перерыва: нейтральный текст, без «успеваете»", () => {
    const t = transfersForDay([lesson("1", "08:10", "09:40", lom), lesson("2", "09:40", "11:10", lom)], { sameBuilding: true });
    expect(transferText(t.get("1")!.verdict)).toBe("Тот же корпус, перерыв 0 мин.");
  });
});
