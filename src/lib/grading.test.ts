import { describe, expect, it } from "vitest";
import { bandFor, disciplineProgress } from "./grading";

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
    expect(p).toMatchObject({ earned: 23.5, graded: 30, remaining: 70, remainingBeforeFinal: 30 });
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

describe("темп и прогноз", () => {
  it("в середине семестра 35 из 40 → прогноз B, не в зоне риска", () => {
    const p = disciplineProgress([
      { maxPoints: 40, points: 35, isFinal: false },
      { maxPoints: 20, points: null, isFinal: false },
      { maxPoints: 40, points: null, isFinal: true },
    ]);
    expect(p.pace).toBeCloseTo(0.875);
    expect(p.forecast?.ects).toBe("B");
    expect(p.atRisk).toBe(false);
  });

  it("темп ниже 60% — зона риска", () => {
    const p = disciplineProgress([
      { maxPoints: 40, points: 19, isFinal: false },
      { maxPoints: 60, points: null, isFinal: true },
    ]);
    expect(p.atRisk).toBe(true);
  });

  it("оценок ещё нет — прогноза нет и риска нет", () => {
    const p = disciplineProgress([{ maxPoints: 100, points: null, isFinal: true }]);
    expect(p).toMatchObject({ pace: null, forecast: null, atRisk: false });
  });
});

describe("точки на проверке и прогноз (ревью Codex 06)", () => {
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
    expect(p).toMatchObject({ earned: 18, graded: 20, pending: 10, remaining: 70, remainingBeforeFinal: 30 });
  });

  it("одна оценённая точка 10/10 не даёт прогноза A", () => {
    const p = disciplineProgress(
      [
        { maxPoints: 10, points: 10, isFinal: false, date: past },
        { maxPoints: 90, points: null, isFinal: true, date: future },
      ],
      now,
    );
    expect(p.forecast).toBeNull();
    expect(p.atRisk).toBe(false);
  });
});
