// Инвиктия — маскот помощника и попутчица на маршруте внутри корпуса (docs/design/MASCOT.md). Рисунок собственный,
// в цветах темы (токены --m-*, --brand…); центр в (0, 0), низ — на y ≈ 10, на линии маршрута.
// Образы за достижения (src/lib/invictia/skins.ts) перекрашивают голову, волосы и звезду и добавляют убор.
import { HAIR, type HairDot, type HatId, type Skin, SKINS } from "@/lib/invictia/skins";

/** Звезда Инвиктии: четырёхлучевая, как на кнопке помощника. На лбу, маленькая — в зрачках. */
export const STAR_EYE = "M0 -4.6Q0.7 -0.7 4.6 0Q0.7 0.7 0 4.6Q-0.7 0.7 -4.6 0Q-0.7 -0.7 0 -4.6Z";

/** Глаз-«миндалина» (левый; правый — зеркально): острый кончик сверху снаружи и снизу у переносицы. */
const EYE = "M-1.9 -2.9Q2.1 -2 1.5 2.6Q-2.3 2.1 -1.9 -2.9Z";
const IRIS = "M-1.2 -1.9Q1.5 -1.2 1.1 2Q-1.6 1.5 -1.2 -1.9Z";
/** Подводка по внешнему краю глаза. */
const LINER = "M-1.9 -2.9Q-2.25 -0.6 -1.75 0.9";
/** Три ресницы-клинышка у верхнего кончика: широкие у глаза, острые на конце, чуть загнуты наружу. */
const LASHES =
  "M-2.05 -2.75Q-2.6 -3.3 -3.1 -4.1Q-2.3 -3.6 -1.75 -3.05Z" +
  "M-2.2 -1.95Q-2.9 -2.2 -3.6 -2.6Q-3 -1.9 -2.15 -1.45Z" +
  "M-2.25 -1Q-2.9 -1 -3.5 -1.05Q-2.9 -0.6 -2.2 -0.5Z";

const BASE = SKINS[0];

/**
 * Лицо Инвиктии в координатах головы (центр 0, 0; радиус 8): звезда на лбу и глаза — открытые
 * (белок, тёмная радужка, звезда-зрачок, ресницы) или весёлые закрытые «^ ^» — их включают .mascot-lit и .mascot-joy.
 * Зрачки помечены data-pupil: кнопка помощника сдвигает их к курсору (data-flip — зеркальный правый глаз).
 * Цвет звезды образа — атрибутом fill: на финише маршрута её всё равно зажигает .mascot-lit (CSS сильнее атрибута).
 */
export function InvictusFace({ skin = BASE }: { skin?: Skin }) {
  const starY = skin.starY ?? -5.6;
  return (
    <>
      {skin.speckles && <Speckles />}
      {skin.glow && <circle cy={starY} r={2.6} fill={skin.glow} opacity={0.35} />}
      {!skin.noStar && (
        <path d={STAR_EYE} transform={`translate(0 ${starY}) scale(${skin.starScale ?? 0.42})`} fill={skin.star} className={`mascot-star ${skin.star ? "" : "fill-on-brand"}`} />
      )}
      <g className="mascot-eyes-open">
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${side * 3.3} 1.8) scale(${-side * 1.3} 1.3)`}>
            <g className="mascot-eye">
              <path d={EYE} className="fill-m-ic-glyph" />
              <g data-pupil data-flip={-side} className="transition-transform duration-300 ease-(--ease-out)">
                <path d={IRIS} className="fill-m-pupil" />
                <path d={STAR_EYE} transform="translate(0.1 0.1) scale(0.22)" fill={skin.pupilStar} className={skin.pupilStar ? "" : "fill-m-ic-glyph"} />
              </g>
              <path d={LINER} strokeWidth={0.55} strokeLinecap="round" className="fill-none stroke-m-pupil" />
              {/* Ресницы чуть короче нарисованных: масштаб к основанию у края глаза. */}
              <path d={LASHES} transform="translate(-2.1 -1.8) scale(0.75) translate(2.1 1.8)" strokeWidth={0.25} strokeLinejoin="round" className="fill-m-pupil stroke-m-pupil" />
            </g>
          </g>
        ))}
      </g>
      <g className="mascot-eyes-happy">
        <path d="M-5.6 2.6Q-3.5 -0.4 -1.4 2.6M1.4 2.6Q3.5 -0.4 5.6 2.6" strokeWidth={1.2} strokeLinecap="round" className="fill-none stroke-m-pupil" />
        <path d="M-5.2 2Q-5.7 1.6 -6.1 1.2M-5.6 2.6Q-6.1 2.55 -6.5 2.35M5.2 2Q5.7 1.6 6.1 1.2M5.6 2.6Q6.1 2.55 6.5 2.35" strokeWidth={0.55} strokeLinecap="round" className="fill-none stroke-m-pupil" />
      </g>
    </>
  );
}

/** Покачивание каждого кружка: своя амплитуда, темп и задержка — волосы «живые». */
const SWAY = [
  { dx: -0.63, dy: -0.9, dur: 3.2, delay: 0 },
  { dx: 0.72, dy: -0.72, dur: 2.7, delay: -0.9 },
  { dx: 0.9, dy: 0.36, dur: 2.3, delay: -1.6 },
  { dx: 0.54, dy: 0.81, dur: 1.9, delay: -0.4 },
  { dx: -0.9, dy: 0.27, dur: 2.5, delay: -1.2 },
  { dx: -0.54, dy: 0.9, dur: 2.1, delay: -0.7 },
];

const dot = (d: HairDot) => <ellipse cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry} transform={d.rot ? `rotate(${d.rot} ${d.cx} ${d.cy})` : undefined} />;

/** Украшение кружка — качается вместе с ним: колпачки ёлочных игрушек, кольцо планеты. */
function hairDeco(skin: Skin, i: number, d: HairDot) {
  if (skin.hairDeco === "ornaments" && (i === 1 || i === 2)) {
    const w = i === 1 ? 1.1 : 0.9;
    return <rect x={d.cx - w / 2} y={d.cy - d.ry - 0.55} width={w} height={0.7} rx={0.25} fill="#e8b84a" />;
  }
  if (skin.hairDeco === "ring" && i === 0)
    return <ellipse cx={d.cx} cy={d.cy} rx={3.9} ry={1} transform={`rotate(-20 ${d.cx} ${d.cy})`} fill="none" stroke="#f3d27a" strokeWidth={0.5} />;
  return null;
}

/**
 * Волосы Инвиктии — кружочки вокруг головы, отдельно от неё (как на наброске). Координаты головы.
 * Горизонталь и вертикаль качаются с разным темпом (.mascot-hair-x/-y): кружок описывает мягкую петлю.
 */
export function InvictusHair({ skin = BASE }: { skin?: Skin }) {
  return (
    <g className={skin.hair || skin.head ? "" : "fill-brand-fill"}>
      {HAIR.map((base, i) => {
        const d = skin.hairPos?.[i] ?? base;
        const h = SWAY[i];
        return (
          <g key={i} className="mascot-hair-x" style={{ "--hx": `${h.dx}px`, animationDuration: `${h.dur * 1.6}s`, animationDelay: `${h.delay}s` } as React.CSSProperties}>
            <g className="mascot-hair-y" style={{ "--hy": `${h.dy}px`, animationDuration: `${h.dur * 2.1}s`, animationDelay: `${h.delay * 1.7}s` } as React.CSSProperties}>
              <g fill={skin.hair?.[i] ?? skin.head}>{dot(d)}</g>
              {hairDeco(skin, i, d)}
            </g>
          </g>
        );
      })}
    </g>
  );
}

const polar = (r: number, deg: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)] as const;

function Speckles() {
  return (
    <g fill="#ffffff" opacity={0.85}>
      {[[-4.8, -4.4], [4.6, -5], [-1.4, 6.4], [2.6, 6.8], [6.4, 4.2], [-6.3, 4.4], [-2.6, -7]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 0.32 : 0.22} />
      ))}
    </g>
  );
}

/** Уборы образов: только округлые формы и скруглённые стыки. Координаты головы. */
const HATS: Record<HatId, { layer: "back" | "band" | "front"; draw: () => React.ReactNode }> = {
  bow: {
    layer: "front",
    draw: () => (
      <g transform="translate(5.2 -7.9) rotate(18)">
        <path d="M-0.6 0.3Q-1.6 2.4 -2.4 3.2M0.6 0.3Q1.4 2.5 2.1 3.3" fill="none" stroke="#e86fa2" strokeWidth={0.8} strokeLinecap="round" />
        <ellipse cx={-2} cy={-0.2} rx={2.2} ry={1.5} transform="rotate(-18 -2 -0.2)" fill="#f592bd" />
        <ellipse cx={2} cy={-0.2} rx={2.2} ry={1.5} transform="rotate(18 2 -0.2)" fill="#f592bd" />
        <circle r={0.95} fill="#e86fa2" />
      </g>
    ),
  },
  holly: {
    layer: "front",
    draw: () => (
      <>
        {[[-5.6, -8.4, -28], [-2.7, -9.1, 22], [-4.1, -10, -80]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={2} ry={0.95} transform={`rotate(${r} ${x} ${y})`} fill="#3e9a6c" />
        ))}
        <circle cx={-4.3} cy={-8.2} r={0.8} fill="#c0283f" />
        <circle cx={-3.3} cy={-7.7} r={0.62} fill="#e0475d" />
        <circle cx={-4.9} cy={-7.3} r={0.55} fill="#e0475d" />
      </>
    ),
  },
  flowers: {
    layer: "front",
    draw: () => (
      <>
        {[-160, -133, -107, -73, -47, -20].map((deg) => {
          const [x, y] = polar(8.3, deg + 13);
          return <ellipse key={deg} cx={x} cy={y} rx={1.1} ry={0.5} transform={`rotate(${deg + 103} ${x} ${y})`} fill="#6bbf8a" />;
        })}
        {[-155, -122, -90, -58, -25].map((deg, i) => {
          const [cx, cy] = polar(8.4, deg);
          return (
            <g key={deg} fill={i % 2 ? "#ffffff" : "#f7a8c4"}>
              {[0, 1, 2, 3, 4].map((k) => {
                const [px, py] = polar(0.95, k * 72 - 90);
                return <circle key={k} cx={cx + px} cy={cy + py} r={0.82} />;
              })}
              <circle cx={cx} cy={cy} r={0.55} fill="#f4c64f" />
            </g>
          );
        })}
      </>
    ),
  },
  gradcap: {
    layer: "front",
    // Шапочка набок, тонкая кисточка с маленькой бусиной лежит на полях.
    draw: () => (
      <g transform="translate(1.3 0.4) rotate(16 0 -9.4)">
        <rect x={-4.8} y={-9.2} width={9.6} height={1.9} rx={0.9} fill="#272b55" />
        <path d="M-7.6 -10.2L0 -12.9L7.6 -10.2L0 -7.6Z" fill="#272b55" stroke="#272b55" strokeWidth={1} strokeLinejoin="round" />
        <path d="M0 -10.2Q3.6 -10.4 5.4 -9.7Q5.8 -8.9 5.7 -8.1" fill="none" stroke="#c9a24a" strokeWidth={0.35} strokeLinecap="round" />
        <circle cy={-10.2} r={0.4} fill="#c9a24a" />
        <circle cx={5.7} cy={-7.8} r={0.45} fill="#c9a24a" />
      </g>
    ),
  },
  laurel: {
    layer: "front",
    draw: () => {
      const [gx, gy] = polar(8.1, 270);
      return (
        <>
          {[200, 213, 226, 239, 252, 288, 301, 314, 327, 340].map((deg, i) => {
            const [x, y] = polar(8.1, deg);
            return <ellipse key={deg} cx={x} cy={y} rx={1.45} ry={0.68} transform={`rotate(${deg + 90 + (deg < 270 ? -25 : 25)} ${x} ${y})`} fill={i % 2 ? "#d6a136" : "#f0c75e"} />;
          })}
          <circle cx={gx} cy={gy - 0.2} r={0.95} fill="#f0c75e" />
          <circle cx={gx} cy={gy - 0.2} r={0.45} fill="#ffffff" opacity={0.8} />
        </>
      );
    },
  },
  headband: {
    layer: "band",
    // Звезда переезжает на повязку и качается вместе с ней.
    draw: () => (
      <>
        <path d="M-7.3 -4.4Q0 -8.4 7.3 -4.4" fill="none" stroke="#ff8a7a" strokeWidth={2.3} strokeLinecap="round" />
        <path d="M-6.6 -3.6Q0 -7.2 6.6 -3.6" fill="none" stroke="#ffffff" strokeWidth={0.35} strokeLinecap="round" opacity={0.8} />
        <path d={STAR_EYE} transform="translate(0 -6.4) scale(0.32)" fill="#ffffff" className="mascot-star" />
      </>
    ),
  },
  ears: {
    layer: "back",
    // Ушки в цветах самой Инвиктии: обводка как у головы отделяет их от неё.
    draw: () => (
      <>
        {[1, -1].map((m) => (
          <g key={m} transform={`scale(${m} 1)`}>
            <path d="M-7.1 -4.4Q-8.4 -12 -6.5 -12.3Q-4.9 -12.1 -1.9 -7.3Z" strokeWidth={1} strokeLinejoin="round" className="fill-brand-fill stroke-m-floor" />
            <path d="M-6.2 -6Q-6.9 -10.4 -6 -10.6Q-5 -10.3 -3.4 -7.6Z" fill="#f7b8d0" />
          </g>
        ))}
      </>
    ),
  },
  beret: {
    layer: "front",
    draw: () => (
      <>
        <ellipse cx={0.8} cy={-9.4} rx={7.6} ry={2.5} transform="rotate(-7 0.8 -9.4)" fill="#2f9c97" />
        <ellipse cx={0.4} cy={-8.1} rx={6.4} ry={0.9} transform="rotate(-7 0.4 -8.1)" fill="#25817d" />
        <circle cx={1.6} cy={-12} r={0.7} fill="#2f9c97" />
        <path d={STAR_EYE} transform="translate(5.4 -9.9) scale(0.3)" fill="#f2c55c" />
      </>
    ),
  },
};

/** Убор образа нужного слоя: «back» — за головой, «band» — по голове под лицом, «front» — поверх. Мягко покачивается (.mascot-hat). */
export function InvictusHat({ skin, layer }: { skin: Skin; layer: "back" | "band" | "front" }) {
  const hat = skin.hat && HATS[skin.hat];
  if (!hat || hat.layer !== layer) return null;
  return <g className="mascot-hat">{hat.draw()}</g>;
}

/**
 * Инвиктия — маскот помощника (она) (docs/design/MASCOT.md, набросок NursuUwU 14.11): синяя голова со звездой на лбу,
 * глаза-миндалины с ресницами и звёздами-зрачками, волосы-кружочки вокруг. Только голова: тело — лишь там, где
 * хватает места для полноценного арта. Голова парит над линией маршрута, низ — на y = 10.
 */
function Invictus({ skin }: { skin: Skin }) {
  return (
    <g transform="translate(0 2)">
      <InvictusHat skin={skin} layer="back" />
      <InvictusHair skin={skin} />
      <circle r={8} strokeWidth={1} fill={skin.head} className={`stroke-m-floor ${skin.head ? "" : "fill-brand-fill"}`} />
      <InvictusHat skin={skin} layer="band" />
      <InvictusFace skin={skin} />
      <InvictusHat skin={skin} layer="front" />
    </g>
  );
}

/** Фигурка на маршруте. Анимация шага — в классах mascot-*, их выключает prefers-reduced-motion (globals.css). */
export function MascotFigure({ skin = BASE }: { skin?: Skin }) {
  // Масштаб вокруг низа головы (0, 10): так она стоит на линии маршрута.
  return (
    <g transform="translate(0 10) scale(1.05) translate(0 -10)">
      <Invictus skin={skin} />
    </g>
  );
}

/**
 * Портрет: отдельный SVG, неподвижный (.mascot-still). Плотная рамка — голова с волосами заполняет значок;
 * с убором рамка выше, чтобы шапочка и венок не обрезались.
 */
export function MascotIcon({ skin = BASE, size = 40 }: { skin?: Skin; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox={skin.hat ? "-14 -14.5 28 28" : "-12.5 -11.5 25 25"} className="mascot-still shrink-0 overflow-visible">
      <MascotFigure skin={skin} />
    </svg>
  );
}
