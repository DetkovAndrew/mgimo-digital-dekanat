// Схемы корпусов: в каждую аудиторию можно попасть из коридора или холла, помещения не налезают друг на друга
// и не выходят за схему. Геометрия по осям, поэтому хватает ограничивающих прямоугольников.
import { describe, expect, it } from "vitest";
import { PLANS, type Pt } from "./plans";

type Box = { x0: number; y0: number; x1: number; y1: number };
const bbox = (pts: Pt[]): Box => ({
  x0: Math.min(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  x1: Math.max(...pts.map((p) => p[0])),
  y1: Math.max(...pts.map((p) => p[1])),
});
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** Общая стена с проходом: зазор не больше стены (≤ 6) и общая длина хотя бы 12 (место для двери). */
function touches(a: Box, b: Box) {
  const gapX = Math.max(a.x0 - b.x1, b.x0 - a.x1);
  const gapY = Math.max(a.y0 - b.y1, b.y0 - a.y1);
  return (gapX <= 6 && gapX >= -0.5 && overlap(a.y0, a.y1, b.y0, b.y1) >= 12) || (gapY <= 6 && gapY >= -0.5 && overlap(a.x0, a.x1, b.x0, b.x1) >= 12);
}

const intersects = (a: Box, b: Box) => overlap(a.x0, a.x1, b.x0, b.x1) > 0 && overlap(a.y0, a.y1, b.y0, b.y1) > 0;
/** Проходимое: коридоры и холлы (проём «второго света» — нет). */
const walkable = (geo: ReturnType<(typeof PLANS)[number]["floor"]>) => [
  ...geo.wings.flatMap((w) => (w.corridor ? [bbox(w.corridor)] : [])),
  ...geo.decor.filter((d) => d.tone === "hall").map((d) => bbox(d.pts)),
];

const floors = PLANS.flatMap((plan) => plan.floors.map((f) => ({ plan, f, geo: plan.floor(f) })));

describe("схемы корпусов", () => {
  it.each(floors.map((x) => [`${x.plan.short}, ${x.f} этаж`, x] as const))("%s: каждая аудитория выходит в коридор или холл", (_, { geo }) => {
    const walk = walkable(geo);
    // Стена с проёмом не считается: аудитория должна касаться именно проходимой части.
    const blind = geo.rooms.filter((r) => !walk.some((w) => touches(bbox(r.pts), w))).map((r) => r.room.number);
    expect(blind).toEqual([]);
  });

  it.each(floors.map((x) => [`${x.plan.short}, ${x.f} этаж`, x] as const))("%s: коридоры и холлы этажа связаны в одну сеть", (_, { geo }) => {
    const walk = walkable(geo);
    const seen = new Set([0]);
    for (const queue = [0]; queue.length; ) {
      const i = queue.pop()!;
      walk.forEach((b, j) => {
        if (!seen.has(j) && (touches(walk[i], b) || intersects(walk[i], b))) {
          seen.add(j);
          queue.push(j);
        }
      });
    }
    expect(seen.size).toBe(walk.length);
  });

  it.each(floors.map((x) => [`${x.plan.short}, ${x.f} этаж`, x] as const))("%s: помещения не пересекаются и помещаются в схему", (_, { plan, geo }) => {
    const h = geo.h ?? plan.view.h;
    const boxes = [...geo.rooms.map((r) => ({ name: r.room.number, b: bbox(r.pts) })), ...geo.decor.filter((d) => d.tone === "service" || d.tone === "quiet").map((d) => ({ name: d.label ?? d.icon, b: bbox(d.pts) }))];
    for (const { name, b } of boxes) {
      expect(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= plan.view.w && b.y1 <= h, `${name} за краем схемы`).toBe(true);
    }
    const clash: string[] = [];
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        if (overlap(a.b.x0, a.b.x1, b.b.x0, b.b.x1) > 0.5 && overlap(a.b.y0, a.b.y1, b.b.y0, b.b.y1) > 0.5) clash.push(`${a.name} × ${b.name}`);
      }),
    );
    expect(clash).toEqual([]);
  });
});
