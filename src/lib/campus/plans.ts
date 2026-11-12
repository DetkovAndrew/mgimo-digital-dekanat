// Условные схемы корпусов «по мотивам» реальных поэтажных планов (не копии): холл-восьмиугольник, крылья под углом,
// веер лекционных, ротонда. Одно описание — и для рисунка, и для строк Room в БД (scripts/sync-rooms.ts). docs/plans/rooms.md.
// Номер аудитории XYAB: X — крыло, Y — этаж, AB — номер на этаже.

export type RoomKind = "LECTURE_HALL" | "CLASSROOM" | "COMPUTER_LAB" | "LAB" | "COWORKING" | "MEETING";

export type PlanRoom = {
  id: string; // «kronv-2337»
  buildingId: string;
  number: string;
  wing: number;
  floor: number;
  kind: RoomKind;
  capacity: number;
  bookable: boolean;
  title: string | null;
};

export type Pt = readonly [number, number];
export type DecorIcon = "toilet" | "stairs" | "food" | "sport" | "book" | "coat" | "entrance";
export type GeoRoom = { room: PlanRoom; pts: Pt[]; c: Pt; narrow: boolean };
export type Decor = { pts: Pt[]; c: Pt; label?: string; icon?: DecorIcon; tone: "hall" | "service" | "quiet" };
export type WingGeo = { wing: number; body: Pt[]; corridor: Pt[]; badge: Pt };
export type FloorGeo = { rooms: GeoRoom[]; decor: Decor[]; wings: WingGeo[]; marks: { at: Pt; icon: DecorIcon }[] };

export type PlanBuilding = {
  buildingId: string;
  short: string; // «ГК»
  title: string; // «Главный корпус»
  view: { w: number; h: number };
  floors: number[];
  wingCount: number;
  rooms: PlanRoom[];
  floor: (f: number) => FloorGeo;
};

// ─── Мини-язык аудиторий: «37:H120*!Название» — номер AB, тип, места, * бронируемая, ! название ─────────────
const KIND: Record<string, RoomKind> = { H: "LECTURE_HALL", C: "CLASSROOM", P: "COMPUTER_LAB", L: "LAB", W: "COWORKING", M: "MEETING" };
type Def = { ab: string; kind: RoomKind; capacity: number; bookable: boolean; title: string | null };

function defs(spec: string): Def[] {
  return spec
    .split(/\s+(?=\d{2}:)/)
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^(\d{2}):([HCPLWM])(\d+)(\*)?(?:!(.+))?$/);
      if (!m) throw new Error(`Схема: не разобрать «${tok}»`);
      return { ab: m[1], kind: KIND[m[2]], capacity: Number(m[3]), bookable: !!m[4], title: m[5]?.trim() || null };
    });
}

// ─── Геометрия ──────────────────────────────────────────────────────────────────────────────────────────────
const deg = (a: number) => (a * Math.PI) / 180;
const add = (p: Pt, d: Pt, k = 1): Pt => [p[0] + d[0] * k, p[1] + d[1] * k];
const centroid = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const polar = (c: Pt, r: number, a: number): Pt => [c[0] + r * Math.cos(deg(a)), c[1] + r * Math.sin(deg(a))];
const octagon = (c: Pt, r: number): Pt[] => Array.from({ length: 8 }, (_, i) => polar(c, r, 22.5 + i * 45));

/** Ширина аудитории вдоль коридора: растёт с вместимостью, лекционные и коворкинги шире. */
const roomWidth = (d: Def) => (d.kind === "LECTURE_HALL" ? Math.min(100, 50 + d.capacity * 0.3) : d.kind === "COWORKING" ? 70 : Math.max(32, Math.min(64, 22 + d.capacity * 0.9)));

type Strip = { wing: number; start: Pt; angle: number; len: number; depth: number; corridor: number; a: string; b: string; endDecor?: { len: number; label: string; icon: DecorIcon } };

type Ctx = { buildingId: string; floor: number; out: FloorGeo; rooms: PlanRoom[] };

function place(ctx: Ctx, wing: number, d: Def, pts: Pt[], narrow = false) {
  const room: PlanRoom = {
    id: `${ctx.buildingId}-${wing}${ctx.floor}${d.ab}`,
    buildingId: ctx.buildingId,
    number: `${wing}${ctx.floor}${d.ab}`,
    wing,
    floor: ctx.floor,
    kind: d.kind,
    capacity: d.capacity,
    bookable: d.bookable,
    title: d.title,
  };
  ctx.rooms.push(room);
  ctx.out.rooms.push({ room, pts, c: centroid(pts), narrow });
}

/** Крыло: коридор по оси, аудитории с обеих сторон; ширины по вместимости, при нехватке места — сжимаются. */
function strip(ctx: Ctx, s: Strip) {
  const d: Pt = [Math.cos(deg(s.angle)), Math.sin(deg(s.angle))];
  const n: Pt = [-d[1], d[0]];
  const at = (t: number, k: number): Pt => add(add(s.start, d, t), n, k);
  const half = s.corridor / 2;
  const full = half + s.depth;
  const rect = (t0: number, t1: number, k0: number, k1: number): Pt[] => [at(t0, k0), at(t1, k0), at(t1, k1), at(t0, k1)];
  ctx.out.wings.push({ wing: s.wing, body: rect(0, s.len, -full - 4, full + 4), corridor: rect(0, s.len, -half, half), badge: at(14, 0) });

  const pad = 20; // у торца — лестница
  const usable = s.len - pad - (s.endDecor?.len ?? 0) - 6;
  const gap = 3;
  for (const [spec, k0, k1] of [
    [s.a, half + gap, full],
    [s.b, -full, -half - gap],
  ] as const) {
    const list = defs(spec);
    const want = list.reduce((sum, x) => sum + roomWidth(x) + gap, 0);
    const scale = Math.min(1, usable / want);
    let t = 6;
    for (const x of list) {
      const w = roomWidth(x) * scale;
      place(ctx, s.wing, x, rect(t, t + w, k0, k1), w < 38);
      t += w + gap;
    }
  }
  ctx.out.marks.push({ at: at(s.len - pad / 2 - 2, 0), icon: "stairs" });
  if (s.endDecor) {
    const e = s.endDecor;
    const pts = rect(s.len - pad - e.len, s.len - pad - 2, -full, full);
    ctx.out.decor.push({ pts, c: centroid(pts), label: e.label, icon: e.icon, tone: "service" });
  }
}

/** Кольцо аудиторий вокруг восьмиугольного холла: сектора по 45°, по часовой от «справа». */
function ring(ctx: Ctx, wing: number, c: Pt, r0: number, r1: number, sectors: Partial<Record<"R" | "BR" | "B" | "BL" | "L" | "TL" | "T" | "TR", string>>) {
  const dir = { R: 0, BR: 45, B: 90, BL: 135, L: 180, TL: 225, T: 270, TR: 315 } as const;
  for (const [key, spec] of Object.entries(sectors)) {
    const a = dir[key as keyof typeof dir];
    const [x] = defs(spec!);
    const pts = [polar(c, r0, a - 21), polar(c, r0, a + 21), polar(c, r1, a + 21), polar(c, r1, a - 21)];
    place(ctx, wing, x, pts, 2 * r0 * Math.sin(deg(21)) < 38);
  }
}

/** Лекционная произвольной формы (веер у входа). */
function hall(ctx: Ctx, wing: number, spec: string, pts: Pt[]) {
  place(ctx, wing, defs(spec)[0], pts);
}

function decor(ctx: Ctx, pts: Pt[], tone: Decor["tone"], label?: string, icon?: DecorIcon) {
  ctx.out.decor.push({ pts, c: centroid(pts), label, icon, tone });
}

// ─── Главный корпус: холл, три крыла, веер лекционных ───────────────────────────────────────────────────────
const KRONV_W = 560;
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [KRONV_W - x, y] as const);
const KRONV: Record<number, { w1: [string, string]; w2: [string, string]; w3: [string, string] }> = {
  1: {
    w1: ["10:C30 17:M6!Деканат 21:C24", "12:C36 32:C40 37:C24"],
    w2: ["01:W60*!Коворкинг «Атриум» 06:C30 12:C24", "04:C32 10:L16 16:P20"],
    w3: ["12:C30 18:L16 24:C28 32:P20", "10:C36 16:C24 21:C30 37:P16"],
  },
  2: {
    w1: ["06:M8*!Переговорная 10:C30 16:P24 21:C28", "08:C40 12:C24 18:P20 24:L16"],
    w2: ["02:C36 08:P24 14:C30*", "04:C28 10:L14 20:C24"],
    w3: ["06:C28 14:C30* 20:P24 26:L16", "08:C36 12:C24 18:C30 24:P20"],
  },
  3: {
    w1: ["01:C30 06:C24 12:P20 18:C36", "04:L14 10:C28 16:C30 22:P24"],
    w2: ["06:C30 12:P20 37:H120", "01:C24 18:C28 26:L16"],
    w3: ["04:C28 10:W24*!Тихая зона 16:C30 22:L14", "06:C24 12:P20 18:C36 26:C28"],
  },
  4: {
    w1: ["04:H90 10:C30 16:P24", "06:C24 12:L16 20:C32 28:C36"],
    w2: ["04:C30 10:P24 16:C28", "02:C24 08:L16 20:C36"],
    w3: ["06:M10*!Переговорная 12:C30 18:P24", "04:C28 10:C24 16:L16 22:C32"],
  },
};

function kronvFloor(ctx: Ctx) {
  const f = KRONV[ctx.floor];
  const hub: Pt = [280, 300];
  const common = { len: 205, depth: 48, corridor: 16 };
  strip(ctx, { wing: 2, start: [280, 242], angle: -90, ...common, len: 170, a: f.w2[0], b: f.w2[1] });
  strip(ctx, { wing: 1, start: [220, 304], angle: 205, ...common, a: f.w1[0], b: f.w1[1], ...(ctx.floor === 1 ? { endDecor: { len: 44, label: "Столовая", icon: "food" as const } } : {}) });
  strip(ctx, { wing: 3, start: [340, 304], angle: -25, ...common, a: f.w3[0], b: f.w3[1] });
  decor(ctx, octagon(hub, 60), "hall", ctx.floor === 1 ? "Холл" : "Рекреация", ctx.floor === 1 ? "coat" : undefined);
  if (ctx.floor === 1 || ctx.floor === 2) {
    const top: Pt[] = [
      [224, 8],
      [336, 8],
      [336, 62],
      [224, 62],
    ];
    decor(ctx, top, "quiet", ctx.floor === 1 ? "Спортзал" : "Библиотека", ctx.floor === 1 ? "sport" : "book");
  }
  if (ctx.floor === 1) {
    // Веер лекционных у входа: слева крыло 1, справа (зеркально) крыло 3.
    const left: [string, Pt[]][] = [
      ["01:H120", [[42, 300], [100, 328], [100, 404], [42, 384]]],
      ["04:H180", [[108, 332], [168, 360], [168, 444], [108, 420]]],
      ["06:H90", [[176, 364], [232, 390], [232, 458], [176, 448]]],
    ];
    const right = ["01:H150", "04:H120", "06:H90"];
    left.forEach(([spec, pts]) => hall(ctx, 1, spec, pts));
    right.forEach((spec, i) => hall(ctx, 3, spec, mirror(left[i][1])));
    decor(ctx, [[252, 392], [308, 392], [308, 430], [252, 430]], "hall", "Вход", "entrance");
    ctx.out.marks.push({ at: [240, 372] as Pt, icon: "toilet" as const }, { at: [320, 372] as Pt, icon: "toilet" as const });
  }
}

// ─── Корпус М: ротонда, коридор к узлу с лекционной, боковой коридор ────────────────────────────────────────
type RingSpec = Partial<Record<"R" | "BR" | "B" | "BL" | "L" | "TL" | "T" | "TR", string>>;
const LOMM: Record<number, { ring: RingSpec; s1: [string, string]; node: RingSpec; s2: [string, string]; inner: string }> = {
  1: {
    inner: "Гардероб",
    ring: { TL: "01:W30*!Коворкинг «Колба»", L: "02:C24", BL: "03:C28", T: "04:L14", BR: "07:C24" },
    s1: ["12:C30 16:P20", "13:L14 17:C24"],
    node: { L: "21:H120", TL: "22:C30", T: "23:C36", TR: "24:L16", R: "25:C24" },
    s2: ["26:C30 29:L16 33:C24 35:C28", "27:P20 31:C28 34:C30"],
  },
  2: {
    inner: "Второй свет",
    ring: { TL: "01:C30", L: "02:C24", BL: "03:L14", T: "05:M8*!Переговорная", BR: "07:C24" },
    s1: ["12:C28 16:P24", "13:C30 20:L14"],
    node: { L: "21:H100", TL: "22:C28", T: "23:C32", TR: "24:P20", R: "25:C24" },
    s2: ["26:C30 29:C24 33:L16 35:C24", "27:C28 31:P20 34:C30"],
  },
  3: {
    inner: "Второй свет",
    ring: { TL: "01:C28", L: "02:C24", BL: "03:C30", T: "04:P20", BR: "07:C24" },
    s1: ["12:C30 16:C24", "09:C30* 13:L14"],
    node: { L: "21:H90", TL: "22:C28", T: "23:C30", TR: "24:L14", R: "25:C24" },
    s2: ["26:C28 29:L16 33:C24 35:C30", "27:P24 31:C30 34:C28"],
  },
};

function lommFloor(ctx: Ctx) {
  const f = LOMM[ctx.floor];
  const rot: Pt = [140, 330];
  // Ротонда: внутренний холл и кольцо аудиторий; справа сверху — выход к узлу, справа — боковой коридор, снизу — вход.
  ctx.out.wings.push({ wing: 1, body: octagon(rot, 112), corridor: octagon(rot, 58), badge: rot });
  decor(ctx, octagon(rot, 50), "hall", f.inner, ctx.floor === 1 ? "coat" : undefined);
  ring(ctx, 1, rot, 62, 108, f.ring);
  // Коридор от ротонды к узлу на северо-восток; узел с лекционной стоит на продолжении коридора.
  const s1 = polar(rot, 118, -45);
  const len1 = 110;
  strip(ctx, { wing: 1, start: s1, angle: -50, len: len1, depth: 44, corridor: 16, a: f.s1[0], b: f.s1[1] });
  const node = polar(s1, len1 + 92, -50);
  ctx.out.wings.push({ wing: 1, body: octagon(node, 84), corridor: octagon(node, 36), badge: node });
  decor(ctx, octagon(node, 32), "hall", "Узел");
  ring(ctx, 1, node, 40, 80, f.node);
  // Боковой коридор на восток.
  strip(ctx, { wing: 1, start: polar(rot, 116, 10), angle: 5, len: 230, depth: 44, corridor: 16, a: f.s2[0], b: f.s2[1] });
  if (ctx.floor === 1) {
    decor(ctx, [[112, 414], [168, 414], [168, 442], [112, 442]], "hall", "Вход", "entrance");
    ctx.out.marks.push({ at: polar(rot, 85, 0), icon: "toilet" });
  }
}

// ─── Сборка ─────────────────────────────────────────────────────────────────────────────────────────────────
type Spec = Omit<PlanBuilding, "rooms" | "floor"> & { draw: (ctx: Ctx) => void };
const SPECS: Spec[] = [
  { buildingId: "kronv", short: "ГК", title: "Главный корпус", view: { w: KRONV_W, h: 470 }, floors: [1, 2, 3, 4], wingCount: 3, draw: kronvFloor },
  { buildingId: "lom-m", short: "М", title: "Корпус М", view: { w: 520, h: 452 }, floors: [1, 2, 3], wingCount: 1, draw: lommFloor },
];

function build({ draw, ...meta }: Spec): PlanBuilding {
  const cache = new Map<number, { geo: FloorGeo; rooms: PlanRoom[] }>();
  const run = (floor: number) => {
    if (!cache.has(floor)) {
      const ctx: Ctx = { buildingId: meta.buildingId, floor, out: { rooms: [], decor: [], wings: [], marks: [] }, rooms: [] };
      draw(ctx);
      cache.set(floor, { geo: ctx.out, rooms: ctx.rooms });
    }
    return cache.get(floor)!;
  };
  const rooms = meta.floors.flatMap((f) => run(f).rooms);
  const dup = rooms.find((r, i) => rooms.findIndex((x) => x.id === r.id) !== i);
  if (dup) throw new Error(`Схема: аудитория ${dup.number} повторяется`);
  return { ...meta, rooms, floor: (f) => run(f).geo };
}

export const PLANS: PlanBuilding[] = SPECS.map(build);
export const planFor = (buildingId: string) => PLANS.find((p) => p.buildingId === buildingId) ?? null;
export const allPlanRooms = () => PLANS.flatMap((p) => p.rooms);

/** «ауд. 2337» → «2337» (номер для сопоставления занятия с аудиторией схемы). */
export const roomNumberFrom = (text: string | null | undefined) => text?.match(/(\d{3,4})/)?.[1] ?? null;

export const roomKindLabel: Record<RoomKind, string> = {
  LECTURE_HALL: "Лекционная",
  CLASSROOM: "Аудитория",
  COMPUTER_LAB: "Компьютерный класс",
  LAB: "Лаборатория",
  COWORKING: "Коворкинг",
  MEETING: "Переговорная",
};
