// Условные схемы корпусов (не копии реальных планов): прямые крылья, светлые коридоры, скруглённые помещения.
// Одно описание — и для рисунка, и для строк Room в БД (scripts/sync-rooms.ts). docs/plans/rooms.md.
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
export type WingGeo = { wing: number; body: Pt[]; corridor: Pt[] | null; badge: Pt | null };
export type FloorGeo = { rooms: GeoRoom[]; decor: Decor[]; wings: WingGeo[]; marks: { at: Pt; icon: DecorIcon }[]; h?: number }; // h — своя высота этажа

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
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

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
  ctx.out.wings.push({ wing: s.wing, body: rect(0, s.len, -full - 6, full + 6), corridor: rect(0, s.len, -half, half), badge: at(14, 0) });

  const pad = 20; // у торца — лестница
  const usable = s.len - pad - (s.endDecor?.len ?? 0) - 6;
  const gap = 4;
  for (const [spec, k0, k1] of [
    [s.a, half + gap, full],
    [s.b, -full, -half - gap],
  ] as const) {
    const list = defs(spec);
    const want = list.reduce((sum, x) => sum + roomWidth(x) + gap, 0);
    const scale = Math.min(1.5, usable / want); // короткий ряд растягивается вдоль крыла
    let t = 6;
    for (const x of list) {
      const w = roomWidth(x) * scale;
      place(ctx, s.wing, x, rect(t, t + w, k0, k1), w < 44);
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

/** Ряд аудиторий в прямоугольнике без коридора (у атриума, в лекционном блоке): ширины по вместимости, ровно по ряду. */
function row(ctx: Ctx, wing: number, spec: string, [x0, y0, x1, y1]: [number, number, number, number], axis: "x" | "y", gap = 6) {
  const list = defs(spec);
  const span = (axis === "x" ? x1 - x0 : y1 - y0) - gap * (list.length - 1);
  const scale = span / list.reduce((sum, x) => sum + roomWidth(x), 0);
  let t = axis === "x" ? x0 : y0;
  for (const x of list) {
    const w = roomWidth(x) * scale;
    place(ctx, wing, x, axis === "x" ? box(t, y0, t + w, y1) : box(x0, t, x1, t + w), (axis === "x" ? w : x1 - x0) < 44);
    t += w + gap;
  }
}

function decor(ctx: Ctx, pts: Pt[], tone: Decor["tone"], label?: string, icon?: DecorIcon) {
  ctx.out.decor.push({ pts, c: centroid(pts), label, icon, tone });
}

/** Подложка без коридора: пристройка, атриум. */
const annex = (ctx: Ctx, wing: number, body: Pt[]) => ctx.out.wings.push({ wing, body, corridor: null, badge: null });

// ─── Главный корпус: холл в центре, крылья 1 и 3 — в стороны, крыло 2 — вверх, у входа лекционные ─────────────
const KRONV_W = 560;
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
  const common = { depth: 48, corridor: 16 };
  strip(ctx, { wing: 2, start: [280, 206], angle: -90, len: 172, ...common, a: f.w2[0], b: f.w2[1] });
  strip(ctx, { wing: 1, start: [222, 260], angle: 180, len: 206, ...common, a: f.w1[0], b: f.w1[1] });
  strip(ctx, { wing: 3, start: [338, 260], angle: 0, len: 206, ...common, a: f.w3[0], b: f.w3[1] });
  decor(ctx, box(214, 196, 346, 324), "hall", ctx.floor === 1 ? "Холл" : "Рекреация", ctx.floor === 1 ? "coat" : undefined);
  if (ctx.floor === 1 || ctx.floor === 2) {
    decor(ctx, box(44, 56, 204, 186), "quiet", ctx.floor === 1 ? "Спортзал" : "Библиотека", ctx.floor === 1 ? "sport" : "book");
    // Лекционный блок у входа (на втором этаже — их второй свет): слева при крыле 1, справа при крыле 3.
    annex(ctx, 1, box(10, 322, 228, 446));
    annex(ctx, 3, box(KRONV_W - 228, 322, KRONV_W - 10, 446));
  }
  if (ctx.floor === 1) {
    row(ctx, 1, "01:H120 04:H180 06:H90", [18, 332, 220, 436], "x");
    row(ctx, 3, "06:H90 04:H120 01:H150", [KRONV_W - 220, 332, KRONV_W - 18, 436], "x");
    decor(ctx, box(250, 318, 310, 366), "hall", "Вход", "entrance");
    decor(ctx, box(KRONV_W - 204, 56, KRONV_W - 44, 186), "service", "Столовая", "food");
    ctx.out.marks.push({ at: [240, 344] as Pt, icon: "toilet" as const }, { at: [320, 344] as Pt, icon: "toilet" as const });
  } else if (ctx.floor === 2) {
    decor(ctx, box(18, 332, 220, 436), "hall", "Второй свет");
    decor(ctx, box(KRONV_W - 220, 332, KRONV_W - 18, 436), "hall", "Второй свет");
  } else ctx.out.h = 340; // выше второго этажа лекционного блока нет: схема ниже, на телефоне крупнее
}

// ─── Корпус М: атриум, от него вверх коридор к лекционной, вправо — длинное крыло ──────────────────────────────
const LOMM: Record<number, { inner: string; side: string; front: [string, string]; spine: [string, string]; hall: string; top: [string, string]; east: [string, string] }> = {
  1: {
    inner: "Гардероб",
    side: "01:W30*!Коворкинг «Колба» 02:C24 03:C28",
    front: ["04:L14", "07:C24"],
    spine: ["12:C30 16:P20", "13:L14 17:C24"],
    hall: "21:H120",
    top: ["22:C30 23:C36", "24:L16 25:C24"],
    east: ["26:C30 29:L16 33:C24 35:C28", "27:P20 31:C28 34:C30"],
  },
  2: {
    inner: "Второй свет",
    side: "01:C30 02:C24 03:L14",
    front: ["05:M8*!Переговорная", "07:C24"],
    spine: ["12:C28 16:P24", "13:C30 20:L14"],
    hall: "21:H100",
    top: ["22:C28 23:C32", "24:P20 25:C24"],
    east: ["26:C30 29:C24 33:L16 35:C24", "27:C28 31:P20 34:C30"],
  },
  3: {
    inner: "Второй свет",
    side: "01:C28 02:C24 03:C30",
    front: ["04:P20", "07:C24"],
    spine: ["12:C30 16:C24", "09:C30* 13:L14"],
    hall: "21:H90",
    top: ["22:C28 23:C30", "24:L14 25:C24"],
    east: ["26:C28 29:L16 33:C24 35:C30", "27:P24 31:C30 34:C28"],
  },
};

function lommFloor(ctx: Ctx) {
  const f = LOMM[ctx.floor];
  const common = { depth: 44, corridor: 16 };
  // Атриум с аудиториями слева и снизу (по центру снизу — вход).
  annex(ctx, 1, box(30, 242, 238, 432));
  decor(ctx, box(100, 250, 230, 370), "hall", f.inner, ctx.floor === 1 ? "coat" : undefined);
  row(ctx, 1, f.side, [38, 250, 94, 370], "y");
  row(ctx, 1, f.front[0], [38, 376, 118, 424], "x");
  row(ctx, 1, f.front[1], [182, 376, 230, 424], "x");
  if (ctx.floor === 1) decor(ctx, box(124, 376, 176, 424), "hall", "Вход", "entrance");
  else ctx.out.marks.push({ at: [150, 400], icon: "stairs" });
  // Вверх от атриума: коридор к лекционной в углу, от неё вправо — верхнее крыло.
  strip(ctx, { wing: 1, start: [165, 252], angle: -90, len: 118, ...common, a: f.spine[0], b: f.spine[1] });
  annex(ctx, 1, box(98, 12, 232, 138));
  row(ctx, 1, f.hall, [106, 20, 224, 130], "x");
  strip(ctx, { wing: 1, start: [228, 75], angle: 0, len: 204, ...common, a: f.top[0], b: f.top[1] });
  // Вправо от атриума: длинное крыло.
  strip(ctx, { wing: 1, start: [234, 310], angle: 0, len: 266, ...common, a: f.east[0], b: f.east[1] });
  if (ctx.floor === 1) ctx.out.marks.push({ at: [216, 264], icon: "toilet" });
}

// ─── Сборка ─────────────────────────────────────────────────────────────────────────────────────────────────
type Spec = Omit<PlanBuilding, "rooms" | "floor"> & { draw: (ctx: Ctx) => void };
const SPECS: Spec[] = [
  { buildingId: "kronv", short: "ГК", title: "Главный корпус", view: { w: KRONV_W, h: 456 }, floors: [1, 2, 3, 4], wingCount: 3, draw: kronvFloor },
  { buildingId: "lom-m", short: "М", title: "Корпус М", view: { w: 514, h: 442 }, floors: [1, 2, 3], wingCount: 1, draw: lommFloor },
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
