import { describe, expect, it } from "vitest";
import { lessonVersion, mskAt, rescheduleSchema } from "./schedule";

const move = { action: "move", id: "l1", expected: "x", reason: "Аудитория на ремонте", date: "2026-11-20", start: "10:00", end: "11:30", building: "kronv", room: "1206" };
const ok = (v: object) => rescheduleSchema.safeParse(v).success;

describe("перенос и отмена пары: проверка ввода", () => {
  it("отмена — только с причиной", () => {
    expect(ok({ action: "cancel", id: "l1", expected: "x", reason: "Болезнь преподавателя" })).toBe(true);
    expect(ok({ action: "cancel", id: "l1", expected: "x", reason: "  " })).toBe(false);
  });

  it("вернуть как было — без причины; лишние поля формы отбрасываются", () => {
    const parsed = rescheduleSchema.safeParse({ ...move, action: "restore", reason: "" });
    expect(parsed.success && parsed.data).toEqual({ action: "restore", id: "l1", expected: "x" });
    expect(ok({ action: "restore", id: "", expected: "x" })).toBe(false);
  });

  it("перенос: длительность 30 минут – 4 часа, в часы занятий, время в формате ЧЧ:ММ", () => {
    expect(ok(move)).toBe(true);
    expect(ok({ ...move, end: "10:15" })).toBe(false); // короче получаса
    expect(ok({ ...move, end: "09:00" })).toBe(false); // конец раньше начала
    expect(ok({ ...move, start: "07:30", end: "09:00" })).toBe(false); // до открытия
    expect(ok({ ...move, start: "21:00", end: "22:00" })).toBe(false); // после закрытия
    expect(ok({ ...move, start: "10:00", end: "14:30" })).toBe(false); // дольше 4 часов
    expect(ok({ ...move, start: "9:00" })).toBe(false);
  });

  it("аудитория — номер из цифр или пусто (та же); неизвестное действие — отказ", () => {
    expect(ok({ ...move, room: "" })).toBe(true);
    expect(ok({ ...move, room: "ауд. 1206" })).toBe(false);
    expect(ok({ ...move, action: "delete" })).toBe(false);
  });

  it("настоящая версия пары проходит проверку (она длиннее 64 символов — так было в первой версии и ломало всё)", () => {
    const expected = lessonVersion({ startsAt: mskAt("2026-11-20", "10:00"), endsAt: mskAt("2026-11-20", "11:30"), status: "RESCHEDULED", room: "ауд. 1206", building: { id: "kronv" } });
    expect(expected.length).toBeGreaterThan(64);
    expect(ok({ ...move, expected })).toBe(true);
  });

  it("московское время", () => {
    expect(mskAt("2026-11-20", "10:00").toISOString()).toBe("2026-11-20T07:00:00.000Z");
  });
});
