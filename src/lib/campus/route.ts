// Маршрут внутри корпуса (docs/plans/indoor-route.md): по сетке проходов этажей, через лестницы, с шагами текстом.
// Чистая функция над схемой (plans.ts): ни БД, ни личных данных. Шаги — и подсказка, и текстовая версия маршрута.
import { planFor, rectOf, walkRects, type Door, type FloorGeo, type PlanBuilding, type Pt, type Rect } from "./plans";

export type RouteEnd = { kind: "entrance" } | { kind: "room"; number: string };
export type RouteLeg = { floor: number; points: Pt[] };
export type RouteTransfer = { floor: number; at: Pt; toFloor: number };
export type StepKind = "start" | "straight" | "left" | "right" | "back" | "up" | "down" | "arrive";
/** Шаг: текст и его кусок пути на этаже floor (для подсветки на схеме; у старта, лестницы и финиша — точка или подход). */
export type RouteStep = { floor: number; kind: StepKind; text: string; meters?: number; path: Pt[] };
export type Route = { legs: RouteLeg[]; transfers: RouteTransfer[]; steps: RouteStep[]; meters: number; startFloor: number };

const CELL = 2; // шаг сетки в единицах схемы
const METERS_PER_UNIT = 0.15; // коридор 16 единиц ≈ 2,4 м
const STAIR_COST = 120; // «длина» одного пролёта лестницы для поиска
const MAX_EXPANDED = 1_600_000; // состояний (клетка × направление)
const TURN_COST = 10; // штраф за поворот: без него в холлах путь идёт «лесенкой»
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
  // Сильнее держимся середины: у стены шаг втрое дороже, в середине коридора почти без надбавки.
  dist.forEach((d, k) => (weight[k] = ok[k] ? 1 + 6 / Math.max(1, d) : Infinity));
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

  // Ходим только вдоль осей (как по коридорам), за поворот — штраф: линия идёт по середине и не «лесенкой».
  // Состояние — клетка и направление, с которым в неё пришли: s = клетка * 4 + направление.
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const h = (n: Node) => {
    const [x, y] = centerOf(gs[fi(n.floor)], n.cell);
    const floorsLeft = Math.abs(fi(n.floor) - fi(to.floor));
    return Math.max(0, Math.abs(x - goalPt[0]) + Math.abs(y - goalPt[1]) - floorsLeft * shift * 2) + floorsLeft * STAIR_COST;
  };
  const best = new Float32Array(total * 4).fill(Infinity);
  const prev = new Int32Array(total * 4).fill(-1);
  const closed = new Uint8Array(total * 4);
  const heap = new Heap();
  const start = id({ floor: from.floor, cell: startCell });
  for (let d = 0; d < 4; d++) {
    best[start * 4 + d] = 0;
    heap.push(start * 4 + d, h(unpack(start)));
  }

  let expanded = 0;
  let reached = -1;
  while (heap.size) {
    const st = heap.pop();
    if (closed[st]) continue;
    closed[st] = 1;
    if (++expanded > MAX_EXPANDED) return null; // предел работы на запрос: схема маленькая, сюда не доходим
    const k = st >> 2;
    const dir = st & 3;
    if (k === goal) {
      reached = st;
      break;
    }
    const n = unpack(k);
    const g = gs[fi(n.floor)];
    const [i, j] = [n.cell % g.cols, Math.floor(n.cell / g.cols)];
    const relax = (to: number, cost: number) => {
      const c = best[st] + cost;
      if (c < best[to]) {
        best[to] = c;
        prev[to] = st;
        heap.push(to, c + h(unpack(to >> 2)));
      }
    };
    DIRS.forEach(([di, dj], d) => {
      const [a, b] = [i + di, j + dj];
      if (a < 0 || b < 0 || a >= g.cols || b >= g.rows) return;
      const cell = b * g.cols + a;
      if (!g.ok[cell]) return;
      relax((offset[fi(n.floor)] + cell) * 4 + d, CELL * ((g.weight[n.cell] + g.weight[cell]) / 2) + (d === dir ? 0 : TURN_COST));
    });
    for (const l of links.get(k) ?? []) relax(l.to * 4 + dir, STAIR_COST);
  }
  if (reached === -1) return null;
  const path: Node[] = [];
  for (let st = reached; st !== -1; st = prev[st]) path.push(unpack(st >> 2));
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

/** Точка напротив двери внутри прохода, куда она открывается. */
function standAt(geo: FloorGeo, wall: Pt, out: Pt, door: Door): Pt {
  const horizontalWall = door.side === "n" || door.side === "s";
  const corridor = geo.wings.map((w) => w.corridor && rectOf(w.corridor)).find((r) => r && inRect(r, out[0], out[1]));
  if (corridor) return horizontalWall ? [wall[0], (corridor[1] + corridor[3]) / 2] : [(corridor[0] + corridor[2]) / 2, wall[1]];
  const sign = door.side === "n" || door.side === "w" ? -1 : 1;
  return horizontalWall ? [wall[0], wall[1] + sign * 10] : [wall[0] + sign * 10, wall[1]];
}

function stepsFor(plan: PlanBuilding, from: Anchor, to: Anchor, legs: RouteLeg[]): RouteStep[] {
  const steps: RouteStep[] = [
    from.door
      ? { floor: from.floor, kind: "start", text: `Выйдите из ${from.label.replace("аудитория", "аудитории")}`, path: [from.wall, from.out] }
      : { floor: from.floor, kind: "start", text: "Войдите через главный вход", path: [from.wall, from.out] },
  ];
  // Начальное направление — от двери (или входа) внутрь: «выйдите и поверните налево» понятнее, чем просто «идите».
  let heading: Pt | null = unit(from.wall, from.out);
  // Конец пути в шагах — место, где сворачиваем к двери: короткий подход от середины коридора к двери не шаг.
  const fl = legs.at(-1)!.points;
  let e = fl.length - 2;
  while (e > 0 && segLen(fl[e - 1], fl[e]) < 12) e--;
  legs.forEach((leg, li) => {
    // Подход к двери аудитории в шаги не входит: о ней скажет финиш.
    const pts = li === legs.length - 1 ? leg.points.slice(0, e + 1) : leg.points;
    for (const g of groupsOf(plan, plan.floor(leg.floor), pts)) {
      if (g.len < 6) continue;
      // Поворот — между направлением, с которым подошли, и первым заметным отрезком участка (шаг из двери не в счёт).
      const kind: StepKind = heading && turnsIn(g.zone) ? turnOf(heading, firstDir(g)) : "straight";
      const verb = { straight: turnsIn(g.zone) ? "Идите" : "Пройдите", left: "Поверните налево и идите", right: "Поверните направо и идите", back: "Развернитесь и идите" }[
        kind as "straight" | "left" | "right" | "back"
      ];
      steps.push({ floor: leg.floor, kind, text: `${verb} ${along(g.zone)}`, meters: metersOf(g.len), path: g.pts });
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
        steps.push({
          floor: leg.floor,
          kind: up ? "up" : "down",
          text: `${up ? "Поднимитесь" : "Спуститесь"} по лестнице${shaft ? ` ${shaft}` : ""} на ${legs[target].floor} этаж`,
          path: [leg.points.at(-1)!],
        });
      }
      heading = null;
    }
  });
  // Финиш: дверь слева или справа по ходу движения.
  const end = fl[e];
  const dir: Pt = e > 0 ? unit(fl[e - 1], fl[e]) : (heading ?? [0, 0]);
  const toDoor: Pt = [to.wall[0] - end[0], to.wall[1] - end[1]];
  const cross = dir[0] * toDoor[1] - dir[1] * toDoor[0];
  const ahead = dir[0] * toDoor[0] + dir[1] * toDoor[1];
  // Направление ненадёжно (сразу после лестницы или дверь рядом): не гадаем со стороной.
  const side = !heading || segLen([0, 0], toDoor) < 1 ? "рядом" : Math.abs(cross) < Math.abs(ahead) * 0.5 ? "прямо по ходу" : cross > 0 ? "справа" : "слева";
  const name = `${to.label[0].toUpperCase()}${to.label.slice(1)}`;
  // Где встать на финише (path[0]): напротив середины двери — по оси коридора, а в холле — в 10 единицах от двери.
  const stand = to.door ? standAt(plan.floor(to.floor), to.wall, to.out, to.door) : null;
  steps.push({ floor: to.floor, kind: "arrive", text: to.door ? `${name} ${side}` : name, path: stand ? [stand, to.wall] : fl.slice(e) });
  return steps;
}

// ─── Упрощение: путь по осям сжимается до точек поворота (скругляет их уже отрисовка) ─────────────────────
function corners(g: Grid, cells: number[]): Pt[] {
  const pts = cells.map((c) => centerOf(g, c));
  return pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const [a, b] = [pts[i - 1], pts[i + 1]];
    return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1])); // не на прямой
  });
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
  const legs: RouteLeg[] = parts.map((p) => ({ floor: p.floor, points: corners(gridOf(plan, p.floor), p.cells) }));
  const transfers: RouteTransfer[] = legs.slice(0, -1).map((l, i) => ({ floor: l.floor, at: l.points.at(-1)!, toFloor: legs[i + 1].floor }));
  legs[0].points.unshift(a.wall);
  legs.at(-1)!.points.push(b.wall);
  const meters = metersOf(legs.reduce((s, l) => s + l.points.slice(1).reduce((t, p, i) => t + segLen(l.points[i], p), 0), 0));
  return { legs, transfers, steps: stepsFor(plan, a, b, legs), meters, startFloor: a.floor };
}

/** Этаж, где закончится подъём или спуск, начатый на участке i (пролёты подряд без остановок). */
export function climbEnd(legs: RouteLeg[], i: number) {
  while (legs[i + 1] && legs[i].points.length <= 1) i++;
  return legs[i].floor;
}
/** Этаж, где начался подъём или спуск, который закончился сразу после участка i. */
export function climbStart(legs: RouteLeg[], i: number) {
  while (i > 0 && legs[i].points.length <= 1) i--;
  return legs[i].floor;
}
