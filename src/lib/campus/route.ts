// Маршрут внутри корпуса (docs/plans/indoor-route.md): по сетке проходов этажей, через лестницы, с шагами текстом.
// Чистая функция над схемой (plans.ts): ни БД, ни личных данных. Шаги — и подсказка, и текстовая версия маршрута.
import { planFor, rectOf, walkRects, type Door, type FloorGeo, type PlanBuilding, type Pt, type Rect } from "./plans";

export type RouteEnd = { kind: "entrance" } | { kind: "room"; number: string };
export type RouteLeg = { floor: number; points: Pt[] };
export type RouteTransfer = { floor: number; at: Pt; toFloor: number };
export type StepKind = "start" | "straight" | "left" | "right" | "back" | "up" | "down" | "arrive";
export type RouteStep = { floor: number; kind: StepKind; text: string; meters?: number };
export type Route = { legs: RouteLeg[]; transfers: RouteTransfer[]; steps: RouteStep[]; meters: number; startFloor: number };

const CELL = 2; // шаг сетки в единицах схемы
const METERS_PER_UNIT = 0.15; // коридор 16 единиц ≈ 2,4 м
const STAIR_COST = 120; // «длина» одного пролёта лестницы для поиска
const MAX_EXPANDED = 400_000;
const inRect = (r: Rect, x: number, y: number) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
const overlaps = (a: Rect, b: Rect) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// ─── Сетка этажа ──────────────────────────────────────────────────────────────────────────────────────────────
type Grid = { floor: number; cols: number; rows: number; ok: Uint8Array; dist: Int16Array; weight: Float32Array; geo: FloorGeo };

function buildGrid(plan: PlanBuilding, floor: number): Grid {
  const geo = plan.floor(floor);
  const cols = Math.ceil(plan.view.w / CELL);
  const rows = Math.ceil((geo.h ?? plan.view.h) / CELL);
  const walk = walkRects(geo);
  const holes = [
    ...geo.rooms.map((r) => rectOf(r.pts)),
    ...geo.decor.filter((d) => d.tone === "room" || d.tone === "void").map((d) => rectOf(d.pts)),
  ];
  const ok = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const [x, y] = [(i + 0.5) * CELL, (j + 0.5) * CELL];
      ok[j * cols + i] = walk.some((r) => inRect(r, x, y)) && !holes.some((r) => inRect(r, x, y)) ? 1 : 0;
    }
  // Расстояние до стены (в клетках, BFS от непроходимых): у стены шаг дороже — путь держится середины коридора.
  const dist = new Int16Array(cols * rows).fill(-1);
  const queue: number[] = [];
  ok.forEach((v, k) => {
    if (!v) {
      dist[k] = 0;
      queue.push(k);
    }
  });
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q];
    const [i, j] = [k % cols, Math.floor(k / cols)];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [a, b] = [i + di, j + dj];
      if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
      const n = b * cols + a;
      if (dist[n] < 0) {
        dist[n] = dist[k] + 1;
        queue.push(n);
      }
    }
  }
  const weight = new Float32Array(cols * rows);
  dist.forEach((d, k) => (weight[k] = ok[k] ? 1 + 2.5 / Math.max(1, d) : Infinity));
  return { floor, cols, rows, ok, dist, weight, geo };
}

const grids = new Map<string, Grid>();
function gridOf(plan: PlanBuilding, floor: number) {
  const key = `${plan.buildingId}:${floor}`;
  if (!grids.has(key)) grids.set(key, buildGrid(plan, floor));
  return grids.get(key)!;
}

/** Ближайшая проходимая клетка к точке (поиск по расширяющимся кольцам). */
function cellNear(g: Grid, [x, y]: Pt): number | null {
  const [ci, cj] = [Math.floor(x / CELL), Math.floor(y / CELL)];
  for (let r = 0; r <= 6; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const [i, j] = [ci + di, cj + dj];
        if (i >= 0 && j >= 0 && i < g.cols && j < g.rows && g.ok[j * g.cols + i]) return j * g.cols + i;
      }
  return null;
}
const centerOf = (g: Grid, k: number): Pt => [((k % g.cols) + 0.5) * CELL, (Math.floor(k / g.cols) + 0.5) * CELL];

// ─── Концы маршрута и лестницы ──────────────────────────────────────────────────────────────────────────────
type Anchor = { floor: number; wall: Pt; out: Pt; door: Door | null; rect: Rect | null; label: string };

/** Середина проёма и точка сразу за ним (в проходе). */
function doorPoints(rect: Rect, door: Door): { wall: Pt; out: Pt } {
  const m = (door.at[0] + door.at[1]) / 2;
  const d = CELL * 1.5;
  if (door.side === "n") return { wall: [m, rect[1]], out: [m, rect[1] - d] };
  if (door.side === "s") return { wall: [m, rect[3]], out: [m, rect[3] + d] };
  if (door.side === "e") return { wall: [rect[2], m], out: [rect[2] + d, m] };
  return { wall: [rect[0], m], out: [rect[0] - d, m] };
}

function anchorOf(plan: PlanBuilding, end: RouteEnd): Anchor | null {
  if (end.kind === "entrance") {
    const floor = plan.floors[0];
    const hall = plan.floor(floor).decor.find((d) => d.tone === "hall" && d.icon === "entrance");
    if (!hall) return null;
    const r = rectOf(hall.pts);
    const x = (r[0] + r[2]) / 2;
    return { floor, wall: [x, r[3]], out: [x, r[3] - CELL * 2], door: null, rect: r, label: "вход" };
  }
  const room = plan.rooms.find((r) => r.number === end.number);
  if (!room) return null;
  const geo = plan.floor(room.floor).rooms.find((r) => r.room.id === room.id);
  if (!geo?.door) return null;
  const rect = rectOf(geo.pts);
  return { floor: room.floor, ...doorPoints(rect, geo.door), door: geo.door, rect, label: `аудитория ${room.number}` };
}

/** Название пролёта лестницы, у входа в которую стоит точка (для шага «Поднимитесь по лестнице …»). */
function stairAt(plan: PlanBuilding, floor: number, at: Pt): string | null {
  const near = stairsOf(plan).filter((s) => s.floor === floor).sort((a, b) => segLen(a.at, at) - segLen(b.at, at))[0];
  return near && segLen(near.at, at) < 8 ? near.shaft : null;
}

type Stair = { floor: number; shaft: string; at: Pt; cell: number };
/** Лестницы этажей с точкой перед дверью (портал); связаны лестницы с одним номером пролёта на соседних этажах. */
const stairCache = new Map<string, Stair[]>();
function stairsOf(plan: PlanBuilding): Stair[] {
  if (!stairCache.has(plan.buildingId)) stairCache.set(plan.buildingId, collectStairs(plan));
  return stairCache.get(plan.buildingId)!;
}
function collectStairs(plan: PlanBuilding): Stair[] {
  return plan.floors.flatMap((floor) => {
    const g = gridOf(plan, floor);
    const list = [
      ...g.geo.decor.filter((d) => d.icon === "stairs" && d.shaft && d.door).map((d) => ({ floor, shaft: d.shaft!, at: doorPoints(rectOf(d.pts), d.door!).out })),
      ...g.geo.marks.filter((m) => m.icon === "stairs" && m.shaft).map((m) => ({ floor, shaft: m.shaft!, at: m.at })),
    ];
    return list.flatMap((s) => {
      const cell = cellNear(g, s.at);
      return cell === null ? [] : [{ ...s, cell }];
    });
  });
}

// ─── Поиск A* по (этаж, клетка) ─────────────────────────────────────────────────────────────────────────────
class Heap {
  private a: [number, number][] = [];
  get size() {
    return this.a.length;
  }
  push(v: number, p: number) {
    const a = this.a;
    a.push([v, p]);
    for (let i = a.length - 1; i > 0; ) {
      const up = (i - 1) >> 1;
      if (a[up][1] <= a[i][1]) break;
      [a[up], a[i]] = [a[i], a[up]];
      i = up;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[0][0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

type Node = { floor: number; cell: number };

function search(plan: PlanBuilding, from: Anchor, to: Anchor): Node[] | null {
  const floors = plan.floors;
  const gs = floors.map((f) => gridOf(plan, f));
  const offset: number[] = [];
  gs.reduce((sum, g, i) => ((offset[i] = sum), sum + g.cols * g.rows), 0);
  const total = gs.reduce((n, g) => n + g.cols * g.rows, 0);
  const fi = (floor: number) => floors.indexOf(floor);
  const id = (n: Node) => offset[fi(n.floor)] + n.cell;
  const unpack = (k: number): Node => {
    let i = gs.length - 1;
    while (offset[i] > k) i--;
    return { floor: floors[i], cell: k - offset[i] };
  };

  const startCell = cellNear(gs[fi(from.floor)], from.out);
  const goalCell = cellNear(gs[fi(to.floor)], to.out);
  if (startCell === null || goalCell === null) return null;
  const goal = id({ floor: to.floor, cell: goalCell });
  const goalPt = centerOf(gs[fi(to.floor)], goalCell);

  // Лестницы: связь между соседними этажами, если пролёты стоят на одном месте.
  const stairs = stairsOf(plan);
  const links = new Map<number, { to: number }[]>();
  let shift = 0; // наибольший сдвиг между входами одного пролёта на соседних этажах — для допустимой эвристики
  for (const a of stairs)
    for (const b of stairs)
      if (a.shaft === b.shaft && Math.abs(fi(a.floor) - fi(b.floor)) === 1) {
        const k = id(a);
        links.set(k, [...(links.get(k) ?? []), { to: id(b) }]);
        shift = Math.max(shift, segLen(a.at, b.at));
      }

  const h = (n: Node) => {
    const [x, y] = centerOf(gs[fi(n.floor)], n.cell);
    const floorsLeft = Math.abs(fi(n.floor) - fi(to.floor));
    return Math.max(0, Math.hypot(x - goalPt[0], y - goalPt[1]) - floorsLeft * shift) + floorsLeft * STAIR_COST;
  };
  const best = new Float64Array(total).fill(Infinity);
  const prev = new Int32Array(total).fill(-1);
  const start = id({ floor: from.floor, cell: startCell });
  best[start] = 0;
  const heap = new Heap();
  heap.push(start, h(unpack(start)));
  const closed = new Uint8Array(total);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

  let expanded = 0;
  while (heap.size) {
    const k = heap.pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (++expanded > MAX_EXPANDED) return null; // предел работы на запрос: схема маленькая, сюда не доходим
    if (k === goal) break;
    const n = unpack(k);
    const g = gs[fi(n.floor)];
    const [i, j] = [n.cell % g.cols, Math.floor(n.cell / g.cols)];
    const relax = (to: number, cost: number) => {
      const c = best[k] + cost;
      if (c < best[to]) {
        best[to] = c;
        prev[to] = k;
        heap.push(to, c + h(unpack(to)));
      }
    };
    for (const [di, dj] of dirs) {
      const [a, b] = [i + di, j + dj];
      if (a < 0 || b < 0 || a >= g.cols || b >= g.rows) continue;
      const cell = b * g.cols + a;
      if (!g.ok[cell]) continue;
      // По диагонали — только если не срезаем угол стены.
      if (di && dj && (!g.ok[j * g.cols + a] || !g.ok[b * g.cols + i])) continue;
      relax(offset[fi(n.floor)] + cell, (di && dj ? Math.SQRT2 : 1) * CELL * ((g.weight[n.cell] + g.weight[cell]) / 2));
    }
    for (const l of links.get(k) ?? []) relax(l.to, STAIR_COST);
  }
  if (prev[goal] === -1 && goal !== start) return null;
  const path: Node[] = [];
  for (let k = goal; k !== -1; k = prev[k]) path.push(unpack(k));
  return path.reverse();
}

// ─── Шаги ───────────────────────────────────────────────────────────────────────────────────────
const metersOf = (units: number) => Math.max(5, Math.round((units * METERS_PER_UNIT) / 5) * 5);
const segLen = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Где идём: коридор крыла, холл, вестибюль, атриум, галерея. */
function zoneOf(plan: PlanBuilding, geo: FloorGeo, [x, y]: Pt): string {
  const corridor = geo.wings.find((w) => w.corridor && inRect(rectOf(w.corridor), x, y));
  const hall = geo.decor.find((d) => d.tone === "hall" && inRect(rectOf(d.pts), x, y));
  if (hall) {
    const r = rectOf(hall.pts);
    if (hall.icon === "entrance") return "вестибюль";
    if (geo.decor.some((d) => d.tone === "void" && overlaps(rectOf(d.pts), r))) return "галерея";
    if (hall.label === "Гардероб") return "атриум";
    return "холл";
  }
  if (corridor) return corridor.name ?? (plan.wingCount > 1 ? `коридор крыла ${corridor.wing}` : "коридор");
  return "проход";
}
const along = (zone: string) =>
  zone.startsWith("коридор") ? `по ${zone.replace("коридор", "коридору")}` : zone === "галерея" ? "по галерее" : `через ${zone}`;

function turnOf(h1: Pt, h2: Pt): StepKind {
  const cross = h1[0] * h2[1] - h1[1] * h2[0];
  const dot = h1[0] * h2[0] + h1[1] * h2[1];
  const angle = (Math.atan2(cross, dot) * 180) / Math.PI;
  if (Math.abs(angle) < 30) return "straight";
  if (Math.abs(angle) > 150) return "back";
  return angle > 0 ? "right" : "left"; // ось y схемы направлена вниз: положительный поворот — по часовой, направо
}
const unit = (a: Pt, b: Pt): Pt => {
  const l = segLen(a, b) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};

/**
 * Шаги: участок пути делится на зоны (коридор крыла, холл, вестибюль, атриум, галерея). В холлах направление не
 * называем (там пересекают открытое пространство), в коридор — «поверните налево/направо» по направлению входа в него.
 */
type Group = { zone: string; pts: Pt[]; len: number };

function groupsOf(plan: PlanBuilding, geo: FloorGeo, pts: Pt[]): Group[] {
  const raw: Group[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    raw.push({ zone: zoneOf(plan, geo, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), pts: [a, b], len: segLen(a, b) });
  }
  // Короткие куски (≤ 1,5 м) — часть соседнего участка, а не отдельный шаг.
  const groups = raw.reduce<Group[]>((out, g) => {
    const last = out.at(-1);
    if (last && (g.len < 10 || last.len < 10)) {
      const keep = last.len >= g.len ? last.zone : g.zone;
      out[out.length - 1] = { zone: keep, pts: [...last.pts, ...g.pts.slice(1)], len: last.len + g.len };
    } else out.push(g);
    return out;
  }, []);
  // Та же зона подряд — один шаг, кроме заметного поворота в коридоре или на галерее (обход проёма).
  return groups.reduce<Group[]>((out, g) => {
    const last = out.at(-1);
    const turns = last && turnsIn(last.zone) && turnOf(unit(last.pts.at(-2)!, last.pts.at(-1)!), unit(g.pts[0], g.pts[1])) !== "straight";
    if (last && last.zone === g.zone && !turns) out[out.length - 1] = { zone: g.zone, pts: [...last.pts, ...g.pts.slice(1)], len: last.len + g.len };
    else out.push(g);
    return out;
  }, []);
}
/** Где поворот стоит назвать: в коридоре и на галерее; холл и вестибюль пересекают как открытое пространство. */
const turnsIn = (zone: string) => zone.startsWith("коридор") || zone === "галерея";

/** Направление первого отрезка длиннее 1 м; короткий шаг из двери направления не задаёт. */
function firstDir(g: Group): Pt {
  for (let i = 1; i < g.pts.length; i++) if (segLen(g.pts[i - 1], g.pts[i]) >= 7) return unit(g.pts[i - 1], g.pts[i]);
  return unit(g.pts[0], g.pts.at(-1)!);
}

function stepsFor(plan: PlanBuilding, from: Anchor, to: Anchor, legs: RouteLeg[]): RouteStep[] {
  const steps: RouteStep[] = [
    from.door
      ? { floor: from.floor, kind: "start", text: `Выйдите из ${from.label.replace("аудитория", "аудитории")}` }
      : { floor: from.floor, kind: "start", text: "Войдите через главный вход" },
  ];
  // Начальное направление — от двери (или входа) внутрь: «выйдите и поверните налево» понятнее, чем просто «идите».
  let heading: Pt | null = unit(from.wall, from.out);
  legs.forEach((leg, li) => {
    // Последний отрезок к двери аудитории в шаги не входит: о ней скажет финиш.
    const pts = li === legs.length - 1 ? leg.points.slice(0, -1) : leg.points;
    for (const g of groupsOf(plan, plan.floor(leg.floor), pts)) {
      if (g.len < 6) continue;
      // Поворот — между направлением, с которым подошли, и первым заметным отрезком участка (шаг из двери не в счёт).
      const kind: StepKind = heading && turnsIn(g.zone) ? turnOf(heading, firstDir(g)) : "straight";
      const verb = { straight: turnsIn(g.zone) ? "Идите" : "Пройдите", left: "Поверните налево и идите", right: "Поверните направо и идите", back: "Развернитесь и идите" }[
        kind as "straight" | "left" | "right" | "back"
      ];
      steps.push({ floor: leg.floor, kind, text: `${verb} ${along(g.zone)}`, meters: metersOf(g.len) });
      heading = unit(g.pts.at(-2)!, g.pts.at(-1)!);
    }
    const next = legs[li + 1];
    if (next) {
      // Несколько пролётов подряд — один шаг сразу до нужного этажа.
      let target = li + 1;
      while (legs[target + 1] && legs[target].points.length <= 1) target++;
      const prevStep = steps.at(-1)!;
      if (prevStep.kind !== "up" && prevStep.kind !== "down") {
        const up = legs[target].floor > leg.floor;
        const shaft = stairAt(plan, leg.floor, leg.points.at(-1)!);
        steps.push({ floor: leg.floor, kind: up ? "up" : "down", text: `${up ? "Поднимитесь" : "Спуститесь"} по лестнице${shaft ? ` ${shaft}` : ""} на ${legs[target].floor} этаж` });
      }
      heading = null;
    }
  });
  // Финиш: дверь слева или справа по ходу движения.
  const last = legs.at(-1)!.points;
  const end = last.at(-2) ?? last[0];
  const dir = heading ?? ([0, 0] as Pt);
  const toDoor: Pt = [to.wall[0] - end[0], to.wall[1] - end[1]];
  const cross = dir[0] * toDoor[1] - dir[1] * toDoor[0];
  const ahead = dir[0] * toDoor[0] + dir[1] * toDoor[1];
  // Направление ненадёжно (сразу после лестницы или дверь рядом): не гадаем со стороной.
  const side = !heading || segLen([0, 0], toDoor) < 1 ? "рядом" : Math.abs(cross) < Math.abs(ahead) * 0.5 ? "прямо по ходу" : cross > 0 ? "справа" : "слева";
  const name = `${to.label[0].toUpperCase()}${to.label.slice(1)}`;
  steps.push({ floor: to.floor, kind: "arrive", text: to.door ? `${name} ${side}` : name });
  return steps;
}

// ─── Сглаживание: прямая между точками пути, если она не ближе к стенам, чем исходный путь ─────────────────
function smooth(g: Grid, cells: number[]): Pt[] {
  if (cells.length < 3) return cells.map((c) => centerOf(g, c));
  const clear = (a: number, b: number, need: number) => {
    const [p, q] = [centerOf(g, a), centerOf(g, b)];
    const n = Math.ceil(segLen(p, q) / (CELL / 2));
    for (let t = 0; t <= n; t++) {
      const [x, y] = [p[0] + ((q[0] - p[0]) * t) / n, p[1] + ((q[1] - p[1]) * t) / n];
      const k = Math.floor(y / CELL) * g.cols + Math.floor(x / CELL);
      if (!g.ok[k] || g.dist[k] < need) return false;
    }
    return true;
  };
  const out = [cells[0]];
  for (let i = 0; i < cells.length - 1; ) {
    let j = i + 1;
    let need = Math.min(g.dist[cells[i]], g.dist[cells[j]]);
    for (let k = i + 2; k < cells.length; k++) {
      const req = Math.min(need, g.dist[cells[k]], 4);
      if (!clear(cells[i], cells[k], req)) break;
      [j, need] = [k, Math.min(need, g.dist[cells[k]])];
    }
    out.push(cells[j]);
    i = j;
  }
  return out.map((c) => centerOf(g, c));
}

/** Маршрут между входом или аудиторией и аудиторией в одном корпусе. null — если конец не найден или пути нет. */
export function findRoute(buildingId: string, from: RouteEnd, to: RouteEnd): Route | null {
  const plan = planFor(buildingId);
  if (!plan) return null;
  const [a, b] = [anchorOf(plan, from), anchorOf(plan, to)];
  if (!a || !b) return null;
  const path = search(plan, a, b);
  if (!path) return null;

  // Режем по этажам: каждый участок — свои точки; на переходах — значок лестницы.
  const parts: { floor: number; cells: number[] }[] = [];
  for (const n of path) {
    const part = parts.at(-1);
    if (part && part.floor === n.floor) part.cells.push(n.cell);
    else parts.push({ floor: n.floor, cells: [n.cell] });
  }
  const legs: RouteLeg[] = parts.map((p) => ({ floor: p.floor, points: smooth(gridOf(plan, p.floor), p.cells) }));
  const transfers: RouteTransfer[] = legs.slice(0, -1).map((l, i) => ({ floor: l.floor, at: l.points.at(-1)!, toFloor: legs[i + 1].floor }));
  legs[0].points.unshift(a.wall);
  legs.at(-1)!.points.push(b.wall);
  const meters = metersOf(legs.reduce((s, l) => s + l.points.slice(1).reduce((t, p, i) => t + segLen(l.points[i], p), 0), 0));
  return { legs, transfers, steps: stepsFor(plan, a, b, legs), meters, startFloor: a.floor };
}
