import { describe, expect, it } from "vitest";
import { bandFor, courseStatus, disciplineProgress, nextAssessment } from "./grading";

describe("шкала University", () => {
  it.each([
    [100, "A", 5],
    [91, "A", 5],
    [90.5, "B", 4],
    [84, "B", 4],
    [83.9, "C", 4],
    [75, "C", 4],
    [74.5, "D", 3],
    [68, "D", 3],
    [67.5, "E", 3],
    [60, "E", 3],
    [59.5, "FX", 2],
    [0, "FX", 2],
  ])("%s баллов → %s / %s", (points, ects, grade) => {
    expect(bandFor(points)).toMatchObject({ ects, grade });
  });
});

describe("прогресс по дисциплине", () => {
  const cps = [
    { maxPoints: 10, points: 8, isFinal: false },
    { maxPoints: 20, points: 15.5, isFinal: false },
    { maxPoints: 30, points: null, isFinal: false },
    { maxPoints: 40, points: null, isFinal: true },
  ];

  it("считает набранное и оставшееся", () => {
    const p = disciplineProgress(cps);
    expect(p).toMatchObject({ earned: 23.5, pending: 0, remaining: 70 });
    expect(p.toPass).toBe(36.5);
    expect(p.passReachable).toBe(true);
  });

  it("порог уже пройден — toPass = 0", () => {
    expect(disciplineProgress([{ maxPoints: 100, points: 72, isFinal: true }]).toPass).toBe(0);
  });

  it("добрать уже невозможно", () => {
    const p = disciplineProgress([
      { maxPoints: 80, points: 10, isFinal: false },
      { maxPoints: 20, points: null, isFinal: true },
    ]);
    expect(p.passReachable).toBe(false);
  });
});

describe("точки на проверке (ревью Codex 06)", () => {
  const now = new Date("2026-11-10T12:00:00+03:00");
  const past = new Date("2026-11-09T23:59:00+03:00");
  const future = new Date("2026-11-20T23:59:00+03:00");

  it("просроченная неоценённая точка — на проверке, не в «можно набрать»", () => {
    const p = disciplineProgress(
      [
        { maxPoints: 20, points: 18, isFinal: false, date: past },
        { maxPoints: 10, points: null, isFinal: false, date: past },
        { maxPoints: 30, points: null, isFinal: false, date: future },
        { maxPoints: 40, points: null, isFinal: true, date: future },
      ],
      now,
    );
    expect(p).toMatchObject({ earned: 18, pending: 10, remaining: 70, toPass: 42, passReachable: true });
  });

  it("баллы на проверке учитываются в достижимости порога", () => {
    const p = disciplineProgress(
      [
        { maxPoints: 50, points: 30, isFinal: false, date: past },
        { maxPoints: 20, points: null, isFinal: false, date: past },
        { maxPoints: 10, points: null, isFinal: true, date: future },
      ],
      now,
    );
    expect(p).toMatchObject({ toPass: 30, pending: 20, remaining: 10, passReachable: true });
  });

  it("ноль баллов — тоже оценка, а не «на проверке»", () => {
    const p = disciplineProgress([{ maxPoints: 20, points: 0, isFinal: false, date: past }], now);
    expect(p).toMatchObject({ earned: 0, pending: 0 });
  });
});

describe("статус дисциплины (ревью Codex 10)", () => {
  const now = new Date("2026-11-10T12:00:00+03:00");
  const at = (d: string) => new Date(`${d}T23:59:00+03:00`);
  const cp = (max: number, points: number | null, due: string, kind = "HOMEWORK") => ({
    kind,
    dueAt: at(due),
    scheduledAt: null,
    maxPoints: max,
    results: points === null ? [] : [{ points, passed: null, grade: null }],
  });

  it("30 баллов посреди семестра — не «F», а сколько осталось до 60", () => {
    expect(courseStatus("EXAM", [cp(40, 30, "2026-10-01"), cp(60, null, "2026-12-30", "EXAM")], now)).toEqual({
      tone: "neutral",
      text: "до 60 ещё 30",
    });
  });

  it("64 балла без аттестации — порог пройден, но не «зачтено»", () => {
    expect(courseStatus("CREDIT", [cp(80, 64, "2026-10-01"), cp(20, null, "2026-12-30", "CREDIT")], now).text).toBe(
      "порог 60 пройден",
    );
  });

  it("даже максимум за оставшееся не даёт 60 — честный сигнал", () => {
    expect(courseStatus("EXAM", [cp(80, 10, "2026-10-01"), cp(20, null, "2026-12-30", "EXAM")], now)).toMatchObject({
      tone: "bad",
    });
  });

  it("«зачтено» — только из результата аттестации", () => {
    const final = { ...cp(100, 55, "2026-06-15", "CREDIT"), results: [{ points: 55, passed: true, grade: null }] };
    expect(courseStatus("CREDIT", [final], now).text).toBe("зачтено");
  });

  it("итог — по выставленной оценке, а не по шкале баллов", () => {
    const final = (r: { points: number | null; passed: boolean | null; grade: number | null }) => ({
      ...cp(100, null, "2026-06-15", "EXAM"),
      results: [r],
    });
    expect(courseStatus("EXAM", [final({ points: 95, passed: null, grade: 2 })], now)).toEqual({
      tone: "bad",
      text: "2",
    });
    expect(courseStatus("EXAM", [final({ points: null, passed: null, grade: 4 })], now)).toEqual({ tone: "ok", text: "4" });
    // Буква ECTS — только когда баллы с оценкой согласуются.
    expect(courseStatus("EXAM", [final({ points: 95, passed: null, grade: 5 })], now)).toEqual({ tone: "ok", text: "5 · A" });
    // Баллы за аттестацию без оценки и без «зачтено» — ещё не итог.
    expect(courseStatus("CREDIT", [{ ...cp(100, 70, "2026-06-15", "CREDIT") }], now).text).toBe("порог 60 пройден");
  });

  it("ближайшая точка — по дате: работа раньше экзамена", () => {
    const hw = cp(20, null, "2026-11-20");
    expect(nextAssessment([cp(60, null, "2026-12-30", "EXAM"), hw, cp(20, 15, "2026-10-01")], now)).toBe(hw);
  });

  it("ближайшая точка — по дате: экзамен раньше работы", () => {
    const exam = cp(60, null, "2026-11-11", "EXAM");
    expect(nextAssessment([cp(20, null, "2026-11-20"), exam], now)).toBe(exam);
  });
});
