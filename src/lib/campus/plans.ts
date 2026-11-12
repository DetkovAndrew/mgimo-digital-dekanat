// Условные схемы корпусов (не реальные планы): крылья, коридор, аудитории по сторонам.
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

type Rect = { x: number; y: number; w: number; h: number };
type WingShape = { wing: number; rect: Rect; dir: "h" | "v" };
type Special = Partial<Pick<PlanRoom, "kind" | "capacity" | "bookable" | "title">>;

type PlanSpec = {
  buildingId: string;
  short: string; // «ГК»
  view: { w: number; h: number };
  floors: number[];
  hall?: Rect & { label: string };
  wings: WingShape[];
  /** Номера AB на каждом этаже каждого крыла. */
  numbers: string[];
  /** Тип по номеру AB (для всех этажей), остальное — обычная аудитория. */
  kindByNumber: Record<string, RoomKind>;
  /** Особые аудитории по полному номеру: коворкинги, переговорные. */
  special: Record<string, Special>;
};

const CAPACITY: Record<RoomKind, number> = { LECTURE_HALL: 120, CLASSROOM: 30, COMPUTER_LAB: 24, LAB: 16, COWORKING: 40, MEETING: 8 };

const SPECS: PlanSpec[] = [
  {
    buildingId: "kronv",
    short: "ГК",
    view: { w: 460, h: 420 },
    floors: [1, 2, 3, 4],
    // «Ш»: три крыла поднимаются от общего холла — вся схема помещается в экран телефона без прокрутки.
    hall: { x: 20, y: 316, w: 420, h: 84, label: "Холл" },
    wings: [
      { wing: 1, rect: { x: 20, y: 28, w: 120, h: 280 }, dir: "v" },
      { wing: 2, rect: { x: 170, y: 28, w: 120, h: 280 }, dir: "v" },
      { wing: 3, rect: { x: 320, y: 28, w: 120, h: 280 }, dir: "v" },
    ],
    numbers: ["01", "04", "06", "10", "14", "16", "17", "21", "26", "32", "37"],
    kindByNumber: { "04": "LECTURE_HALL", "37": "LECTURE_HALL", "16": "COMPUTER_LAB", "26": "COMPUTER_LAB", "21": "LAB" },
    special: {
      "1117": { kind: "MEETING", title: "Деканат", capacity: 6, bookable: false },
      "2101": { kind: "COWORKING", title: "Коворкинг «Атриум»", capacity: 40, bookable: true },
      "3310": { kind: "COWORKING", title: "Тихая зона", capacity: 20, bookable: true },
      "1206": { kind: "MEETING", title: "Переговорная", capacity: 8, bookable: true },
      "3406": { kind: "MEETING", title: "Переговорная", capacity: 10, bookable: true },
      "2214": { bookable: true },
      "3214": { bookable: true },
    },
  },
  {
    buildingId: "lom-m",
    short: "М",
    view: { w: 460, h: 240 },
    floors: [1, 2, 3],
    wings: [{ wing: 1, rect: { x: 20, y: 28, w: 420, h: 150 }, dir: "h" }],
    hall: { x: 160, y: 186, w: 140, h: 44, label: "Вход" },
    numbers: ["01", "05", "09", "13", "17", "20", "21", "25", "29", "33"],
    kindByNumber: { "21": "LECTURE_HALL", "20": "LAB", "29": "LAB", "13": "LAB", "33": "COMPUTER_LAB" },
    special: {
      "1101": { kind: "COWORKING", title: "Коворкинг «Колба»", capacity: 30, bookable: true },
      "1205": { kind: "MEETING", title: "Переговорная", capacity: 8, bookable: true },
      "1309": { bookable: true },
    },
  },
];

export type PlanBuilding = Omit<PlanSpec, "numbers" | "kindByNumber" | "special"> & { rooms: PlanRoom[] };

function expand(spec: PlanSpec): PlanBuilding {
  const rooms: PlanRoom[] = [];
  for (const { wing } of spec.wings)
    for (const floor of spec.floors)
      for (const ab of spec.numbers) {
        const number = `${wing}${floor}${ab}`;
        const sp = spec.special[number] ?? {};
        const kind = sp.kind ?? spec.kindByNumber[ab] ?? "CLASSROOM";
        rooms.push({
          id: `${spec.buildingId}-${number}`,
          buildingId: spec.buildingId,
          number,
          wing,
          floor,
          kind,
          capacity: sp.capacity ?? CAPACITY[kind],
          bookable: sp.bookable ?? false,
          title: sp.title ?? null,
        });
      }
  return { buildingId: spec.buildingId, short: spec.short, view: spec.view, floors: spec.floors, hall: spec.hall, wings: spec.wings, rooms };
}

export const PLANS: PlanBuilding[] = SPECS.map(expand);
export const planFor = (buildingId: string) => PLANS.find((p) => p.buildingId === buildingId) ?? null;
export const allPlanRooms = () => PLANS.flatMap((p) => p.rooms);

/** «ауд. 2337» → «2337» (номер для сопоставления занятия с аудиторией схемы). */
export const roomNumberFrom = (text: string | null | undefined) => text?.match(/(\d{3,4})/)?.[1] ?? null;

/** Прямоугольники аудиторий этажа на схеме: вдоль коридора крыла, нечётные по индексу — с одной стороны, чётные — с другой. */
export function layoutFloor(plan: PlanBuilding, floor: number) {
  const out: { room: PlanRoom; rect: Rect }[] = [];
  const corridors: Rect[] = [];
  for (const w of plan.wings) {
    const rooms = plan.rooms.filter((r) => r.wing === w.wing && r.floor === floor);
    const perSide = Math.ceil(rooms.length / 2);
    const { x, y, w: W, h: H } = w.rect;
    const gap = 3;
    if (w.dir === "h") {
      const depth = (H - 18) / 2;
      corridors.push({ x, y: y + depth, w: W, h: 18 });
      const step = W / perSide;
      rooms.forEach((room, i) => {
        const side = i % 2;
        const k = Math.floor(i / 2);
        out.push({ room, rect: { x: x + k * step + gap, y: side ? y + depth + 18 + gap : y + gap, w: step - 2 * gap, h: depth - 2 * gap } });
      });
    } else {
      const depth = (W - 18) / 2;
      corridors.push({ x: x + depth, y, w: 18, h: H });
      const step = H / perSide;
      rooms.forEach((room, i) => {
        const side = i % 2;
        const k = Math.floor(i / 2);
        out.push({ room, rect: { x: side ? x + depth + 18 + gap : x + gap, y: y + k * step + gap, w: depth - 2 * gap, h: step - 2 * gap } });
      });
    }
  }
  return { rooms: out, corridors };
}

export const roomKindLabel: Record<RoomKind, string> = {
  LECTURE_HALL: "Лекционная",
  CLASSROOM: "Аудитория",
  COMPUTER_LAB: "Компьютерный класс",
  LAB: "Лаборатория",
  COWORKING: "Коворкинг",
  MEETING: "Переговорная",
};
