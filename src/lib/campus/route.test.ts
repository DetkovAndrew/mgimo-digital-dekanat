// Маршрут внутри корпуса (docs/plans/indoor-route.md, ревью Codex 27): достижимость, путь только по проходам,
// лестницы, обход «второго света», шаги.
import { describe, expect, it } from "vitest";
import { PLANS, planFor, rectOf, walkRects, type Pt, type Rect } from "./plans";
import { findRoute } from "./route";

const inRect = (r: Rect, [x, y]: Pt, pad = 0) => x > r[0] - pad && x < r[2] + pad && y > r[1] - pad && y < r[3] + pad;

/** Точки отрезков маршрута (кроме концов у дверей): каждая в проходе и не в помещении или проёме. */
function offPath(buildingId: string, floor: number, pts: Pt[]): Pt[] {
  const geo = planFor(buildingId)!.floor(floor);
  const walk = walkRects(geo);
  const solid = [...geo.rooms.map((r) => rectOf(r.pts)), ...geo.decor.filter((d) => d.tone === "room" || d.tone === "void").map((d) => rectOf(d.pts))];
  const bad: Pt[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let t = 0; t <= n; t++) {
      const p: Pt = [a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n];
      if (!walk.some((r) => inRect(r, p, 0.01)) || solid.some((r) => inRect(r, p, -0.01))) bad.push(p);
    }
  }
  return bad;
}

describe("маршрут внутри корпуса", () => {
  it.each(PLANS.map((p) => [p.short, p] as const))("%s: от входа достижима каждая аудитория, по лестницам ровно на разницу этажей", (_, plan) => {
    for (const room of plan.rooms) {
      const r = findRoute(plan.buildingId, { kind: "entrance" }, { kind: "room", number: room.number });
      expect(r, room.number).not.toBeNull();
      expect(r!.legs.map((l) => l.floor)).toEqual(Array.from({ length: room.floor - plan.floors[0] + 1 }, (_, i) => plan.floors[0] + i));
      expect(r!.steps[0]).toMatchObject({ kind: "start", text: "Войдите через главный вход" });
      expect(r!.steps.at(-1)).toMatchObject({ kind: "arrive", floor: room.floor });
      expect(r!.steps.at(-1)!.text).toContain(room.number);
    }
  });

  it.each(PLANS.map((p) => [p.short, p] as const))("%s: путь идёт только по коридорам и холлам", (_, plan) => {
    for (const room of plan.rooms) {
      const r = findRoute(plan.buildingId, { kind: "entrance" }, { kind: "room", number: room.number })!;
      r.legs.forEach((leg, i) => {
        // Концы маршрута — на стене у двери или входа: проверяем без первого и последнего отрезка.
        const pts = leg.points.slice(i === 0 ? 1 : 0, i === r.legs.length - 1 ? -1 : undefined);
        expect(offPath(plan.buildingId, leg.floor, pts), `${room.number}, ${leg.floor} этаж`).toEqual([]);
      });
    }
  });

  it("корпус М, 2 этаж: путь между аудиториями у атриума обходит проём «второго света» по галерее", () => {
    const r = findRoute("lom-m", { kind: "room", number: "1201" }, { kind: "room", number: "1207" })!;
    expect(r.legs).toHaveLength(1);
    expect(offPath("lom-m", 2, r.legs[0].points.slice(1, -1))).toEqual([]);
    expect(r.steps.some((s) => s.text.includes("галере"))).toBe(true);
    // Обход проёма — с поворотами: текст не должен сводиться к одному «идите по галерее».
    expect(r.steps.filter((s) => s.kind === "left" || s.kind === "right").length).toBeGreaterThanOrEqual(2);
  });

  it("возврат на этаж (3 → 2 → 3): шаги идут в порядке прохождения, финиш на этаже аудитории", () => {
    const r = findRoute("kronv", { kind: "room", number: "1318" }, { kind: "room", number: "3322" })!;
    const collapse = (xs: number[]) => xs.filter((x, i) => x !== xs[i - 1]);
    expect(collapse(r.legs.map((l) => l.floor))).toEqual([3, 2, 3]);
    expect(collapse(r.steps.map((s) => s.floor))).toEqual([3, 2, 3]);
    expect(r.steps.map((s) => s.kind).filter((k) => k === "up" || k === "down")).toEqual(["down", "up"]);
    expect(r.steps.at(-1)).toMatchObject({ kind: "arrive", floor: 3 });
  });

  it("из аудитории в аудиторию на другом этаже: выход, лестница с названием, этаж назначения", () => {
    const r = findRoute("kronv", { kind: "room", number: "1121" }, { kind: "room", number: "3310" })!;
    expect(r.steps[0]).toMatchObject({ kind: "start", text: "Выйдите из аудитории 1121" });
    const climb = r.steps.find((s) => s.kind === "up")!;
    expect(climb.text).toMatch(/^Поднимитесь по лестнице .+ на 3 этаж$/);
    expect(r.steps.filter((s) => s.kind === "up")).toHaveLength(1); // несколько пролётов подряд — один шаг
    expect(r.transfers.map((t) => [t.floor, t.toFloor])).toEqual([
      [1, 2],
      [2, 3],
    ]);
    const down = findRoute("kronv", { kind: "room", number: "1406" }, { kind: "room", number: "1101" })!;
    expect(down.steps.find((s) => s.kind === "down")!.text).toContain("на 1 этаж");
  });

  it("неизвестные корпус, аудитория или начало — маршрута нет", () => {
    expect(findRoute("nope", { kind: "entrance" }, { kind: "room", number: "1101" })).toBeNull();
    expect(findRoute("kronv", { kind: "entrance" }, { kind: "room", number: "9999" })).toBeNull();
    expect(findRoute("kronv", { kind: "room", number: "abc" }, { kind: "room", number: "1101" })).toBeNull();
  });
});
