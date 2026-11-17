import { describe, expect, it } from "vitest";
import { parseFind } from "./find";

// Меню «Начало» прячет прошедшее время сегодня — разбор адреса должен искать то же, что показывает меню (ревью Codex 60).
describe("parseFind: начало в прошлом", () => {
  const now = new Date("2026-11-16T14:10:00+03:00"); // понедельник, 14:10 МСК

  it("сегодня в прошедшее время — ближайший шаг сетки", () => {
    expect(parseFind({ d: "2026-11-16", t: "10:00", m: "60" }, now)).toMatchObject({ d: "2026-11-16", t: "14:30", m: 60 });
    expect(parseFind({ d: "2026-11-16", t: "14:00", m: "60" }, now)).toMatchObject({ d: "2026-11-16", t: "14:30" });
  });

  it("будущее сегодня и другие дни — как в адресе", () => {
    expect(parseFind({ d: "2026-11-16", t: "14:30", m: "60" }, now)).toMatchObject({ d: "2026-11-16", t: "14:30" });
    expect(parseFind({ d: "2026-11-17", t: "10:00", m: "60" }, now)).toMatchObject({ d: "2026-11-17", t: "10:00" });
  });

  it("поздно вечером прошедшее сегодня — завтра в 10:00", () => {
    const late = new Date("2026-11-16T20:40:00+03:00");
    expect(parseFind({ d: "2026-11-16", t: "19:00", m: "60" }, late)).toMatchObject({ d: "2026-11-17", t: "10:00" });
  });
});
