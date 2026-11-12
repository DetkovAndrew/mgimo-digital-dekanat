// Условные схемы корпусов (не копии реальных планов): корпус обходит двор кольцом коридоров, аудитории стоят
// по обе стороны коридора, в углах — холлы с лестницами. Каждая аудитория выходит в коридор или холл (plans.test.ts).
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
export type DecorIcon = "toilet" | "stairs" | "food" | "sport" | "book" | "coat" | "entrance" | "tree";
export type GeoRoom = { room: PlanRoom; pts: Pt[]; c: Pt; narrow: boolean };
// hall — проходимое (холл, вход, галерея); void — проём «второго света», по нему не пройти; service и quiet — помещения.
export type Decor = { pts: Pt[]; c: Pt; label?: string; icon?: DecorIcon; tone: "hall" | "void" | "service" | "quiet" };
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

// ─── Мини-язык: «37:H120*!Название» — аудитория (номер AB, тип, места, * бронируемая, ! название);
//     «~90:food!Столовая» — помещение без номера длиной 90 вдоль коридора (иконка, подпись). ──────────────────────
const KIND: Record<string, RoomKind> = { H: "LECTURE_HALL", C: "CLASSROOM", P: "COMPUTER_LAB", L: "LAB", W: "COWORKING", M: "MEETING" };
type Def = { ab: string; kind: RoomKind; capacity: number; bookable: boolean; title: string | null };
type Space = { len: number; icon: DecorIcon; label: string };
type Slot = { def: Def } | { space: Space };

function slots(spec: string): Slot[] {
  return spec
    .split(/\s+(?=\d{2}:|~)/)
    .filter(Boolean)
    .map((tok) => {
      const sp = tok.match(/^~(\d+):(\w+)!(.+)$/);
      if (sp) return { space: { len: Number(sp[1]), icon: sp[2] as DecorIcon, label: sp[3].trim() } };
      const m = tok.match(/^(\d{2}):([HCPLWM])(\d+)(\*)?(?:!(.+))?$/);
      if (!m) throw new Error(`Схема: не разобрать «${tok}»`);
      return { def: { ab: m[1], kind: KIND[m[2]], capacity: Number(m[3]), bookable: !!m[4], title: m[5]?.trim() || null } };
    });
}

// ─── Геометрия: всё по осям, прямоугольник — [x0, y0, x1, y1] ─────────────────────────────────────────────────
type Rect = readonly [number, number, number, number];
const box = ([x0, y0, x1, y1]: Rect): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const mid = ([x0, y0, x1, y1]: Rect): Pt => [(x0 + x1) / 2, (y0 + y1) / 2];

/** Длина аудитории вдоль коридора: растёт с вместимостью, лекционные и коворкинги длиннее. */
const roomLen = (d: Def) => (d.kind === "LECTURE_HALL" ? Math.min(100, 50 + d.capacity * 0.3) : d.kind === "COWORKING" ? 70 : Math.max(32, Math.min(64, 22 + d.capacity * 0.9)));
const slotLen = (s: Slot) => ("def" in s ? roomLen(s.def) : s.space.len);
const spaceTone = (icon: DecorIcon): Decor["tone"] => (icon === "sport" || icon === "book" ? "quiet" : "service");

const CORRIDOR = 16; // ширина коридора
const DEPTH = 44; // глубина аудитории от коридора
const GAP = 4; // стены между помещениями
const PAD = 4; // от аудитории до края корпуса

type Ctx = { buildingId: string; floor: number; out: FloorGeo; rooms: PlanRoom[] };

function place(ctx: Ctx, wing: number, d: Def, r: Rect) {
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
  // Узкая: номер мельче, без подписи мест. Номер пишется горизонтально, поэтому важны обе стороны.
  ctx.out.rooms.push({ room, pts: box(r), c: mid(r), narrow: r[2] - r[0] < 44 || r[3] - r[1] < 32 });
}

function decor(ctx: Ctx, r: Rect, tone: Decor["tone"], label?: string, icon?: DecorIcon) {
  ctx.out.decor.push({ pts: box(r), c: mid(r), label, icon, tone });
}

/**
 * Ряд помещений вдоль отрезка [from, to] оси, длины по вместимости. Вдоль коридора ряд растягивается не больше 2×
 * (одна переговорная не займёт всё крыло); fill — ровно по отрезку (ряд у атриума, лекционный блок).
 */
function lay(ctx: Ctx, wing: number, spec: string, axis: "x" | "y", from: number, to: number, across: readonly [number, number], fill = false) {
  const list = slots(spec);
  const free = to - from - GAP * (list.length - 1);
  const k = free / list.reduce((sum, x) => sum + slotLen(x), 0);
  const scale = fill ? k : Math.min(2, k);
  let t = from;
  for (const x of list) {
    const len = slotLen(x) * scale;
    const r: Rect = axis === "x" ? [t, across[0], t + len, across[1]] : [across[0], t, across[1], t + len];
    if ("def" in x) place(ctx, wing, x.def, r);
    else decor(ctx, r, spaceTone(x.space.icon), x.space.label, x.space.icon);
    t += len + GAP;
  }
}

type Run = { wing: number; axis: "x" | "y"; at: number; from: number; to: number; a?: string; b?: string; depthA?: number; depthB?: number; badge?: boolean };

/**
 * Коридор вдоль оси с помещениями по обе стороны. axis "x" — горизонтальный (a — сверху, b — снизу),
 * "y" — вертикальный (a — слева, b — справа). at — координата середины коридора поперёк.
 */
function run(ctx: Ctx, r: Run) {
  const half = CORRIDOR / 2;
  const [da, db] = [r.depthA ?? DEPTH, r.depthB ?? DEPTH];
  const lo = r.at - half - GAP - da - PAD;
  const hi = r.at + half + GAP + db + PAD;
  const rect = (a0: number, a1: number, c0: number, c1: number): Rect => (r.axis === "x" ? [a0, c0, a1, c1] : [c0, a0, c1, a1]);
  const badge: Pt | null = r.badge ? (r.axis === "x" ? [r.from + 16, r.at] : [r.at, r.from + 16]) : null;
  ctx.out.wings.push({ wing: r.wing, body: box(rect(r.from, r.to, lo, hi)), corridor: box(rect(r.from, r.to, r.at - half, r.at + half)), badge });
  const [from, to] = [r.from + PAD, r.to - PAD];
  if (r.a) lay(ctx, r.wing, r.a, r.axis, from, to, [r.at - half - GAP - da, r.at - half - GAP]);
  if (r.b) lay(ctx, r.wing, r.b, r.axis, from, to, [r.at + half + GAP, r.at + half + GAP + db]);
}

/** Подложка без коридора: лекционный блок, атриум. */
const annex = (ctx: Ctx, wing: number, r: Rect) => ctx.out.wings.push({ wing, body: box(r), corridor: null, badge: null });

/** Холл на стыке коридоров: лестница и туалет — в наружных углах, коридоры подходят к середине сторон. */
type Corner = "tl" | "tr" | "bl" | "br";
function lobby(ctx: Ctx, r: Rect, stairs: Corner, toilet: Corner) {
  decor(ctx, r, "hall");
  const s = 40;
  const at = (c: Corner): Rect => {
    const x = c.endsWith("l") ? r[0] + PAD : r[2] - PAD - s;
    const y = c.startsWith("t") ? r[1] + PAD : r[3] - PAD - s;
    return [x, y, x + s, y + s];
  };
  decor(ctx, at(stairs), "service", undefined, "stairs");
  decor(ctx, at(toilet), "service", undefined, "toilet");
}

// ─── Главный корпус: кольцо вокруг двора. Крыло 2 — сверху, 1 — слева, 3 — справа; снизу (1–2 этажи) — вход
//     и лекционные, выше третьего этажа корпус открыт во двор буквой «П». ─────────────────────────────────────
const KRONV_W = 440;
const KRONV: Record<number, { w1: [string, string]; w2: [string, string]; w3: [string, string] }> = {
  1: {
    w1: ["~84:sport!Спортзал 10:C30 17:M6!Деканат 21:C24", "12:C36 32:C40 37:C24"],
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
  const W = KRONV_W;
  const t = 10 + 60; // ось верхнего и боковых коридоров: 10 от края + половина толщины крыла
  const corner = 130; // размер углового холла
  const ring = ctx.floor <= 2; // нижняя часть кольца есть на 1–2 этажах
  const yb = 442; // ось нижнего коридора
  const sideEnd = ring ? yb - 60 : 382;

  run(ctx, { wing: 2, axis: "x", at: t, from: corner, to: W - corner, a: f.w2[0], b: f.w2[1], badge: true });
  run(ctx, { wing: 1, axis: "y", at: t, from: corner, to: sideEnd, a: f.w1[0], b: f.w1[1], badge: true });
  run(ctx, { wing: 3, axis: "y", at: W - t, from: corner, to: sideEnd, a: f.w3[0], b: f.w3[1], badge: true });
  lobby(ctx, [10, 10, corner, corner], "tl", "tr");
  lobby(ctx, [W - corner, 10, W - 10, corner], "tr", "tl");
  decor(ctx, [corner + 6, corner + 6, W - corner - 6, sideEnd - (ring ? 6 : -48)], "quiet", "Двор", "tree");

  if (ring) {
    // Нижний коридор от угла до угла; во двор — служебные помещения, наружу — лекционные (на 2 этаже их второй свет).
    const top = yb - 60;
    const hallY = yb + CORRIDOR / 2; // низ коридора и угловых холлов
    annex(ctx, 1, [10, top, W / 2, 530]);
    annex(ctx, 3, [W / 2, top, W - 10, 530]);
    ctx.out.wings.push({ wing: 1, body: box([corner, top, W - corner, hallY]), corridor: box([10, yb - CORRIDOR / 2, W - 10, hallY]), badge: null });
    lay(ctx, 1, ctx.floor === 1 ? "~90:coat!Гардероб ~80:food!Столовая" : "~180:book!Библиотека", "x", corner + PAD, W - corner - PAD, [top + PAD, yb - CORRIDOR / 2 - GAP], true);
    lobby(ctx, [10, top, corner, hallY], "tl", "tr");
    lobby(ctx, [W - corner, top, W - 10, hallY], "tr", "tl");
    const [r0, r1] = [hallY + GAP, hallY + GAP + 72]; // ряд под коридором
    if (ctx.floor === 1) {
      lay(ctx, 1, "01:H120 04:H180 06:H90", "x", 14, W / 2 - 34, [r0, r1], true);
      lay(ctx, 3, "06:H90 04:H120 01:H150", "x", W / 2 + 34, W - 14, [r0, r1], true);
      decor(ctx, [W / 2 - 30, r0, W / 2 + 30, r1 + 4], "hall", "Вход", "entrance");
    } else {
      decor(ctx, [14, r0, W / 2 - 34, r1], "void", "Второй свет");
      decor(ctx, [W / 2 + 34, r0, W - 14, r1], "void", "Второй свет");
      decor(ctx, [W / 2 - 30, r0, W / 2 + 30, r1], "service", undefined, "stairs");
    }
  } else {
    // Выше второго этажа нижней части нет: крылья заканчиваются лестничными холлами.
    decor(ctx, [10, sideEnd, corner, sideEnd + 48], "service", undefined, "stairs");
    decor(ctx, [W - corner, sideEnd, W - 10, sideEnd + 48], "service", undefined, "stairs");
    ctx.out.h = sideEnd + 58;
  }
}

// ─── Корпус М: атриум внизу слева; от него вверх коридор к угловому холлу и верхнему крылу, вправо — длинное крыло.
//     Между крыльями — два двора. ────────────────────────────────────────────────────────────────────────────
const LOMM_W = 440;
const LOMM: Record<number, { side: string; front: [string, string]; spine: [string, string]; hall: string; top: [string, string]; east: [string, string] }> = {
  1: {
    side: "01:W30*!Коворкинг «Колба» 02:C24 03:C28",
    front: ["04:L14", "07:C24"],
    spine: ["12:C30 16:P20", "13:L14 17:C24"],
    hall: "21:H120",
    top: ["22:C30 23:C36", "24:L16 25:C24"],
    east: ["26:C30 29:L16 33:C24 35:C28", "27:P20 31:C28 34:C30"],
  },
  2: {
    side: "01:C30 02:C24 03:L14",
    front: ["05:M8*!Переговорная", "07:C24"],
    spine: ["12:C28 16:P24", "13:C30 20:L14"],
    hall: "21:H100",
    top: ["22:C28 23:C32", "24:P20 25:C24"],
    east: ["26:C30 29:C24 33:L16 35:C24", "27:C28 31:P20 34:C30"],
  },
  3: {
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
  const W = LOMM_W;
  const atrium: Rect = [70, 300, 230, 420];
  const x = (atrium[0] + atrium[2]) / 2; // ось коридора вверх
  const y = (atrium[1] + atrium[3]) / 2; // ось коридора вправо
  // Атриум: аудитории слева и снизу выходят прямо в него, по центру снизу — вход (выше — лестница).
  annex(ctx, 1, [10, 296, atrium[2] + 4, 480]);
  // На 1 этаже атриум — холл с гардеробом; выше — галерея по периметру проёма, двери аудиторий выходят на неё.
  if (ctx.floor === 1) decor(ctx, atrium, "hall", "Гардероб", "coat");
  else {
    decor(ctx, atrium, "hall");
    decor(ctx, [atrium[0] + 22, atrium[1] + 22, atrium[2] - 22, atrium[3] - 22], "void", "Второй свет");
  }
  lay(ctx, 1, f.side, "y", atrium[1], atrium[3], [14, atrium[0] - GAP], true);
  lay(ctx, 1, f.front[0], "x", 14, 112, [atrium[3] + GAP, 476], true);
  lay(ctx, 1, f.front[1], "x", 180, atrium[2], [atrium[3] + GAP, 476], true);
  if (ctx.floor === 1) decor(ctx, [116, atrium[3] + GAP, 176, 480], "hall", "Вход", "entrance");
  else decor(ctx, [116, atrium[3] + GAP, 176, 476], "service", undefined, "stairs");
  // Вверх — коридор к угловому холлу; слева от холла лекционная, вправо — верхнее крыло.
  run(ctx, { wing: 1, axis: "y", at: x, from: 130, to: atrium[1], a: f.spine[0], b: f.spine[1] });
  lobby(ctx, [x - 60, 10, x + 60, 130], "tr", "tl");
  annex(ctx, 1, [10, 10, x - 56, 130]);
  lay(ctx, 1, f.hall, "x", 14, x - 60 - GAP, [14, 126], true);
  run(ctx, { wing: 1, axis: "x", at: 70, from: x + 60, to: W - 10, a: f.top[0], b: f.top[1] });
  // Вправо от атриума — длинное крыло; в торцах крыльев — лестницы.
  run(ctx, { wing: 1, axis: "x", at: y, from: atrium[2], to: W - 10, a: f.east[0], b: f.east[1] });
  ctx.out.marks.push({ at: [W - 22, 70], icon: "stairs" }, { at: [W - 22, y], icon: "stairs" });
  // Дворы между крыльями.
  decor(ctx, [14, 136, x - 66, 290], "quiet", "Двор", "tree");
  decor(ctx, [x + 66, 136, W - 14, 290], "quiet", "Двор", "tree");
}

// ─── Сборка ─────────────────────────────────────────────────────────────────────────────────────────────────
type Spec = Omit<PlanBuilding, "rooms" | "floor"> & { draw: (ctx: Ctx) => void };
const SPECS: Spec[] = [
  { buildingId: "kronv", short: "ГК", title: "Главный корпус", view: { w: KRONV_W, h: 540 }, floors: [1, 2, 3, 4], wingCount: 3, draw: kronvFloor },
  { buildingId: "lom-m", short: "М", title: "Корпус М", view: { w: LOMM_W, h: 490 }, floors: [1, 2, 3], wingCount: 1, draw: lommFloor },
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
