// Образы Инвиктии за достижения (концепт NursuUwU 15.11, правила — docs/design/MASCOT.md). Силуэт не меняется:
// голова r=8, шесть волос-кружочков, глаза и звезда на лбу. Меняются цвета и одна деталь — убор (рисунки уборов —
// src/components/mascots.tsx). Цвета образа — цвета персонажа, одинаковые в обеих темах; у базового образа — токены.

export type SkinId = "base" | "fresher" | "newyear" | "spring" | "honors" | "invicta" | "sport" | "cosmos" | "cat" | "travel";
export type HatId = "bow" | "holly" | "flowers" | "gradcap" | "laurel" | "headband" | "ears" | "beret";
/** Чем открывается: флаг ачивки с сервера, «season» — участие в событии (в прототипе отметок ещё нет), null — сразу. */
export type SkinUnlock = "excellent" | "invicta" | "sport60" | "sport100" | "booker" | "travel" | "season" | null;

/** Волосы-кружочки: координаты головы. Образ может перекрасить их и, если убор закрыт, сдвинуть. */
export type HairDot = { cx: number; cy: number; rx: number; ry: number; rot?: number };
export const HAIR: readonly HairDot[] = [
  { cx: -8.9, cy: -6.2, rx: 2.2, ry: 2.9, rot: 35 },
  { cx: 8.2, cy: -6.3, rx: 1.6, ry: 1.4 },
  { cx: 9.8, cy: -2.2, rx: 1.2, ry: 1.2 },
  { cx: 9.6, cy: 0.9, rx: 0.45, ry: 0.6 },
  { cx: -10.5, cy: -1.3, rx: 1, ry: 0.85 },
  { cx: -10.1, cy: 2.3, rx: 0.55, ry: 1, rot: -15 },
];

export type Skin = {
  id: SkinId;
  name: string;
  /** Как выглядит — подпись в профиле. */
  about: string;
  unlock: SkinUnlock;
  /** Что сделать, чтобы открыть. */
  hint: string;
  /** Цвет головы; нет — фирменный (токен). */
  head?: string;
  /** Цвета шести волос; нет — как голова. */
  hair?: readonly string[];
  /** Сдвиг волос, чтобы не закрывать убор: индекс → новое положение. */
  hairPos?: Partial<Record<number, HairDot>>;
  star?: string;
  pupilStar?: string;
  glow?: string;
  /** Звезда на лбу: положение и размер, если её сдвигает убор; null — звезду несёт убор. */
  starY?: number;
  starScale?: number;
  noStar?: boolean;
  hat?: HatId;
  /** Колпачки ёлочных игрушек и кольцо планеты — украшения отдельных кружочков. */
  hairDeco?: "ornaments" | "ring";
  /** Звёздочки на голове (ночное небо). */
  speckles?: boolean;
};

const BLUE = "#3b4cca";

export const SKINS: readonly Skin[] = [
  { id: "base", name: "Инвиктия", about: "Знакомая помощница из кружка в углу", unlock: null, hint: "" },
  {
    id: "fresher",
    name: "Первокурсница",
    about: "Розовый бант набок",
    unlock: "season",
    hint: "прийти на посвящение в студенты (сентябрь, отметка пропуском на входе)",
    head: BLUE,
    hat: "bow",
  },
  {
    id: "newyear",
    name: "Ёлочная",
    about: "Красная, как ёлочный шар, с веточкой остролиста",
    unlock: "season",
    hint: "прийти на новогоднее мероприятие (декабрь, отметка пропуском на входе)",
    head: "#d9485e",
    hair: ["#3e9a6c", "#3e9a6c", "#f0c75e", "#e8b84a", "#57b585", "#3e9a6c"],
    star: "#f4cf63",
    pupilStar: "#f4cf63",
    glow: "#f4cf63",
    hat: "holly",
    hairDeco: "ornaments",
  },
  {
    id: "spring",
    name: "Весенняя",
    about: "Венок из розовых и белых цветов",
    unlock: "season",
    hint: "прийти на весенний фестиваль (апрель–май, отметка пропуском на входе)",
    head: "#5465dc",
    hair: Array(6).fill("#f7a8c4"),
    star: "#ffffff",
    hat: "flowers",
  },
  {
    id: "honors",
    name: "Отличница",
    about: "Шапочка бакалавра набок и золотая звезда",
    unlock: "excellent",
    hint: "закрыть сессию на «отлично»",
    head: BLUE,
    star: "#f2c55c",
    pupilStar: "#f2c55c",
    starY: -5.1,
    starScale: 0.4,
    hat: "gradcap",
  },
  {
    id: "invicta",
    name: "Непобедимая",
    about: "Золотой лавровый венок — по имени: invictus значит «непобедимый»",
    unlock: "invicta",
    hint: "закрыть две сессии подряд без пересдач",
    head: BLUE,
    hair: Array(6).fill("#f0c75e"),
    star: "#f6d57a",
    pupilStar: "#f6d57a",
    glow: "#f6d57a",
    hat: "laurel",
  },
  { id: "sport", name: "Спортивная", about: "Коралловая повязка со звездой", unlock: "sport60", hint: "набрать 60 баллов по физкультуре", head: BLUE, noStar: true, hat: "headband" },
  {
    id: "cosmos",
    name: "Звёздная",
    about: "Ночное небо и планета с кольцом",
    unlock: "sport100",
    hint: "набрать все 100 баллов по физкультуре",
    head: "#2b2f86",
    hair: ["#b9a6f5", "#8fa2ff", "#8de0c4", "#ffffff", "#8fa2ff", "#b9a6f5"],
    star: "#8ff3cf",
    pupilStar: "#8ff3cf",
    glow: "#8ff3cf",
    hairDeco: "ring",
    speckles: true,
  },
  {
    id: "cat",
    name: "Котик из коворкинга",
    about: "Ободок с кошачьими ушками",
    unlock: "booker",
    hint: "забронировать аудиторию",
    head: BLUE,
    hat: "ears",
    // Верхние кружочки отходят ниже и наружу, чтобы не закрывать ушки.
    hairPos: {
      0: { cx: -10.7, cy: -4.9, rx: 1.9, ry: 2.5, rot: 35 },
      1: { cx: 10.4, cy: -5.1, rx: 1.5, ry: 1.3 },
      2: { cx: 10.9, cy: -2, rx: 1.1, ry: 1.1 },
      4: { cx: -11.6, cy: -0.6, rx: 0.95, ry: 0.8 },
    },
  },
  {
    id: "travel",
    name: "Путешественница",
    about: "Бирюзовый берет со значком-звездой",
    unlock: "travel",
    hint: "побывать на занятиях в трёх разных корпусах за семестр",
    head: BLUE,
    starY: -4.7,
    starScale: 0.38,
    hat: "beret",
  },
];

export const SKIN_IDS = SKINS.map((s) => s.id) as [SkinId, ...SkinId[]];
export const skinById = (id: string | null | undefined): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];

/** Открыт ли образ при этих флагах ачивок. Сезонные в прототипе закрыты: отметок участия в событиях нет. */
export function isSkinUnlocked(skin: Skin, flags: Record<Exclude<SkinUnlock, "season" | null>, boolean>) {
  if (skin.unlock === null) return true;
  if (skin.unlock === "season") return false;
  return flags[skin.unlock];
}
