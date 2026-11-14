// Пасхалка: попутчик, который идёт по маршруту внутри корпуса. Фигурки: собственные рисунки в цветах темы
// (токены --m-*, --brand…), центр в (0, 0), ступни на y ≈ 10. Часть открывается ачивками (src/server/dal/achievements.ts).
import type { Achievements } from "@/server/dal/achievements";

export type MascotId = "invictus" | "claude" | "codex" | "dot" | "owl" | "runner" | "rocket" | "cat" | "compass";
/**
 * Чем открывается: ачивка с сервера, «навигатор» (дошёл до конца трёх маршрутов) или «вопрос» (спросил Инвиктуса) —
 * эти два считает браузер; null — открыт сразу.
 */
export type Unlock = keyof Achievements | "navigator" | "asked" | null;

export const MASCOTS: { id: MascotId; name: string; about: string; unlock: Unlock; hint?: string }[] = [
  { id: "invictus", name: "Инвиктус", about: "Наш помощник: звёзды в глазах, всегда знает дорогу", unlock: null },
  { id: "claude", name: "Искорка", about: "Оранжевая подружка Инвиктуса", unlock: "asked", hint: "задать вопрос Инвиктусу" },
  { id: "codex", name: "Терминал", about: "Командная строка на ножках", unlock: null },
  { id: "dot", name: "Точка", about: "Просто точка, без лишнего", unlock: null },
  { id: "owl", name: "Сова", about: "Для круглых отличников", unlock: "excellent", hint: "все оценки прошлой сессии «5»" },
  { id: "runner", name: "Бегун", about: "Набрал 60 баллов по физкультуре", unlock: "sport60", hint: "60 баллов по физкультуре за семестр" },
  { id: "rocket", name: "Ракета", about: "Максимум по физкультуре", unlock: "sport100", hint: "все 100 баллов по физкультуре" },
  { id: "cat", name: "Кот", about: "Любит тихие коворкинги", unlock: "booker", hint: "забронировать аудиторию" },
  { id: "compass", name: "Компас", about: "Знает корпус наизусть", unlock: "navigator", hint: "дойти до конца трёх маршрутов" },
];

const Legs = ({ className, y = 6, xs = [-6, -2, 2, 6] }: { className: string; y?: number; xs?: number[] }) => (
  <>
    {xs.map((x, i) => (
      <rect key={i} x={x - 1} y={y} width={2} height={4} rx={0.6} className={`${className} ${i % 2 ? "mascot-leg-b" : "mascot-leg-a"}`} />
    ))}
  </>
);
const Eyes = ({ y = -2, dx = 3.2, r = 1.3 }: { y?: number; dx?: number; r?: number }) => (
  <>
    <circle cx={-dx} cy={y} r={r} className="fill-m-ic-exit" />
    <circle cx={dx} cy={y} r={r} className="fill-m-ic-exit" />
  </>
);

/** Звезда Инвиктуса: четырёхлучевая, как на кнопке помощника. Сейчас — на лбу и на груди, маленькая — в зрачках. */
export const STAR_EYE = "M0 -4.6Q0.7 -0.7 4.6 0Q0.7 0.7 0 4.6Q-0.7 0.7 -4.6 0Q-0.7 -0.7 0 -4.6Z";

/** Глаз-«миндалина» (левый; правый — зеркально): острый кончик сверху снаружи и снизу у переносицы. */
const EYE = "M-1.9 -2.9Q2.1 -2 1.5 2.6Q-2.3 2.1 -1.9 -2.9Z";
const IRIS = "M-1.2 -1.9Q1.5 -1.2 1.1 2Q-1.6 1.5 -1.2 -1.9Z";

/** Голова Инвиктуса: центр и радиус. По ним же рисуется лицо на кнопке помощника. */
export const HEAD = { cy: -6, r: 8 };

/**
 * Лицо Инвиктуса: звезда на лбу и глаза — открытые (белок, тёмная радужка, звезда-зрачок)
 * или «^ ^» для радости, их включает .mascot-lit.
 */
export function InvictusFace() {
  return (
    <>
      <path d={STAR_EYE} transform="translate(0 -11.3) scale(0.45)" className="mascot-star fill-on-brand" />
      <g className="mascot-eyes-open">
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${side * 3.3} -5.2) scale(${-side * 1.3} 1.3)`}>
            <g className="mascot-eye">
              <path d={EYE} className="fill-m-ic-glyph" />
              <path d={IRIS} className="mascot-pupil fill-m-pupil" />
              <path d={STAR_EYE} transform="translate(0.1 0.1) scale(0.22)" className="mascot-pupil fill-m-ic-glyph" />
            </g>
          </g>
        ))}
      </g>
      <g className="mascot-eyes-happy">
        <path d="M-5.6 -4.4Q-3.5 -7.4 -1.4 -4.4M1.4 -4.4Q3.5 -7.4 5.6 -4.4" strokeWidth={1.3} strokeLinecap="round" className="fill-none stroke-m-pupil" />
      </g>
    </>
  );
}

/**
 * Инвиктус — маскот помощника (docs/design/MASCOT.md, набросок NursuUwU 14.11): крупная синяя голова со звездой
 * на лбу, два глаза-миндалины со звёздами-зрачками, мини-тело со звездой на груди, ножки с белой полоской
 * и круглые ладошки, которые парят рядом с телом, не касаясь его.
 */
function Invictus() {
  return (
    <g>
      {/* Ножки: с белой полоской «кед» у ступни */}
      <g className="mascot-leg-a">
        <rect x={-3.5} y={6.4} width={3} height={4.2} rx={1.5} className="fill-brand-fill" />
        <path d="M-3.3 9.2H-0.7" strokeWidth={0.6} strokeLinecap="round" className="stroke-on-brand" />
      </g>
      <g className="mascot-leg-b">
        <rect x={0.5} y={6.4} width={3} height={4.2} rx={1.5} className="fill-brand-fill" />
        <path d="M0.7 9.2H3.3" strokeWidth={0.6} strokeLinecap="round" className="stroke-on-brand" />
      </g>
      {/* Тело чуть ниже головы, с зазором-«шеей», как на наброске */}
      <path d="M-2.9 3.2Q0 2.6 2.9 3.2Q4 5.2 3.4 7.6H-3.4Q-4 5.2 -2.9 3.2Z" className="fill-brand-fill" />
      <path d={STAR_EYE} transform="translate(0 5.3) scale(0.36)" className="fill-on-brand" />
      {/* Ладошки отдельно от тела */}
      <circle cx={-6.6} cy={4.8} r={1.8} className="mascot-arm-a fill-brand-fill" />
      <circle cx={6.6} cy={4.8} r={1.8} className="mascot-arm-b fill-brand-fill" />
      <circle cy={HEAD.cy} r={HEAD.r} strokeWidth={1} className="fill-brand-fill stroke-m-floor" />
      <InvictusFace />
    </g>
  );
}

/** Рост фигурок выровнен: масштаб вокруг ступней (0, 10), чтобы все стояли на линии маршрута одинаково. */
const SCALE: Record<MascotId, number> = { invictus: 0.98, claude: 0.94, codex: 1.15, dot: 1.3, owl: 0.94, runner: 1.15, rocket: 0.82, cat: 1, compass: 1.1 };

/** Фигурка попутчика. Анимация шага в классах mascot-*, их выключает prefers-reduced-motion (globals.css). */
export function MascotFigure({ id }: { id: MascotId }) {
  return (
    // Точка без ступней — масштаб вокруг центра, она идёт прямо по линии.
    <g transform={id === "dot" ? `scale(${SCALE[id]})` : `translate(0 10) scale(${SCALE[id]}) translate(0 -10)`}>
      <Figure id={id} />
    </g>
  );
}

function Figure({ id }: { id: MascotId }) {
  switch (id) {
    case "invictus":
      return <Invictus />;
    case "claude":
      return (
        <g>
          <Legs className="fill-m-ic-food" />
          <rect x={-11} y={-4} width={3} height={4} rx={1} className="fill-m-ic-food" />
          <rect x={8} y={-4} width={3} height={4} rx={1} className="fill-m-ic-food" />
          <rect x={-8.5} y={-9} width={17} height={16} rx={3.5} className="fill-m-ic-food" />
          <rect x={-5} y={-4.5} width={2.4} height={4} rx={1} className="fill-m-ic-exit" />
          <rect x={2.6} y={-4.5} width={2.4} height={4} rx={1} className="fill-m-ic-exit" />
          {/* Искорка на макушке */}
          <path d="M0 -15.5V-10.5M-2.5 -13H2.5M-1.8 -14.8L1.8 -11.2M1.8 -14.8L-1.8 -11.2" strokeWidth={1.3} strokeLinecap="round" className="mascot-spark stroke-m-ic-food" />
        </g>
      );
    case "codex":
      return (
        <g>
          <Legs className="fill-m-ic-exit" />
          <rect x={-9.5} y={-10} width={19} height={16.5} rx={3} className="fill-m-ic-exit" />
          <rect x={-7.5} y={-8} width={15} height={11} rx={1.5} className="fill-ink" />
          <path d="M-5 -5.5L-2.5 -2.8L-5 -0.2" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="fill-none stroke-ok" />
          <rect x={-1} y={-0.9} width={4.5} height={1.3} rx={0.5} className="mascot-cursor fill-ok" />
        </g>
      );
    case "dot":
      return <circle r={5.5} strokeWidth={2} className="fill-brand stroke-m-floor" />;
    case "owl":
      return (
        <g>
          <Legs className="fill-m-ic-food" xs={[-3, 3]} y={7} />
          <ellipse rx={8.5} ry={9.5} cy={-1} className="fill-m-ic-book" />
          <ellipse rx={5.5} ry={5} cy={3} className="fill-m-hall" />
          <circle cx={-3.6} cy={-3.5} r={3.2} className="fill-m-ic-glyph" />
          <circle cx={3.6} cy={-3.5} r={3.2} className="fill-m-ic-glyph" />
          <Eyes y={-3.5} dx={3.6} r={1.5} />
          <path d="M-1.2 -1.2L1.2 -1.2L0 1z" className="fill-m-ic-food" />
          {/* Академическая шапочка */}
          <path d="M-8 -11L0 -14.5L8 -11L0 -7.5z" className="fill-m-ic-exit" />
          <path d="M6 -10.5V-7" strokeWidth={1} className="stroke-m-ic-food" />
        </g>
      );
    case "runner":
      return (
        <g>
          <rect x={-6} y={7} width={5} height={3} rx={1.2} className="mascot-leg-a fill-m-ic-glyph stroke-m-ic-exit" strokeWidth={0.8} />
          <rect x={1} y={7} width={5} height={3} rx={1.2} className="mascot-leg-b fill-m-ic-glyph stroke-m-ic-exit" strokeWidth={0.8} />
          <circle r={9} cy={-1} className="fill-brand" />
          <rect x={-9} y={-7} width={18} height={3} className="fill-bad-fill" />
          <circle cx={-3.2} cy={-0.5} r={1.9} className="fill-m-ic-glyph" />
          <circle cx={3.2} cy={-0.5} r={1.9} className="fill-m-ic-glyph" />
          <Eyes y={-0.5} r={1} />
        </g>
      );
    case "rocket":
      return (
        <g>
          <path d="M-3 7Q0 15 3 7z" className="mascot-flame fill-m-ic-food" />
          <path d="M-6 3L-9 8L-4 6zM6 3L9 8L4 6z" className="fill-bad-fill" />
          <path d="M0 -15C6 -9 6 0 4 7H-4C-6 0 -6 -9 0 -15z" strokeWidth={1} className="fill-m-ic-glyph stroke-m-ic-exit" />
          <circle cy={-4} r={2.6} strokeWidth={1} className="fill-brand stroke-m-ic-exit" />
        </g>
      );
    case "cat":
      return (
        <g>
          <Legs className="fill-m-ic-stairs" xs={[-4, 4]} y={7} />
          <path d="M8 4Q14 2 12 -5" strokeWidth={2} strokeLinecap="round" className="mascot-tail fill-none stroke-m-ic-stairs" />
          <path d="M-8 -6L-7 -13L-2.5 -8.5zM8 -6L7 -13L2.5 -8.5z" className="fill-m-ic-stairs" />
          <ellipse rx={8.5} ry={8} cy={-1} className="fill-m-ic-stairs" />
          <circle cx={-3.2} cy={-2.5} r={1.9} className="fill-m-ic-glyph" />
          <circle cx={3.2} cy={-2.5} r={1.9} className="fill-m-ic-glyph" />
          <Eyes y={-2.5} r={1} />
          <path d="M-1 0.6H1L0 1.8z" className="fill-m-wc stroke-m-ic-wc" strokeWidth={0.5} />
        </g>
      );
    case "compass":
      return (
        <g>
          <Legs className="fill-m-ic-exit" xs={[-3, 3]} y={7} />
          <circle r={9} cy={-1} strokeWidth={2} className="fill-m-ic-glyph stroke-brand" />
          <g className="mascot-needle">
            <path d="M0 -8L2 -1H-2z" className="fill-bad-fill" />
            <path d="M0 6L2 -1H-2z" className="fill-brand" />
          </g>
          <circle cy={-1} r={1.2} className="fill-m-ic-exit" />
        </g>
      );
  }
}

/** Превью для окна выбора и кнопки: отдельный маленький SVG. */
export function MascotIcon({ id, size = 40 }: { id: MascotId; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="-16 -18 32 32" className="shrink-0 overflow-visible">
      <MascotFigure id={id} />
    </svg>
  );
}
