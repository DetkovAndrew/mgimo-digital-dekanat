// Инвиктия — маскот помощника и попутчица на маршруте внутри корпуса (docs/design/MASCOT.md). Рисунок собственный,
// в цветах темы (токены --m-*, --brand…); центр в (0, 0), низ — на y ≈ 10, на линии маршрута.
// Других попутчиков убрали 15.11 (решение капитана): вместо них будут образы Инвиктии за достижения.

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

/**
 * Лицо Инвиктии в координатах головы (центр 0, 0; радиус 8): звезда на лбу и глаза — открытые
 * (белок, тёмная радужка, звезда-зрачок, ресницы) или весёлые закрытые «^ ^» — их включают .mascot-lit и .mascot-joy.
 * Зрачки помечены data-pupil: кнопка помощника сдвигает их к курсору (data-flip — зеркальный правый глаз).
 */
export function InvictusFace() {
  return (
    <>
      <path d={STAR_EYE} transform="translate(0 -5.6) scale(0.42)" className="mascot-star fill-on-brand" />
      <g className="mascot-eyes-open">
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${side * 3.3} 1.8) scale(${-side * 1.3} 1.3)`}>
            <g className="mascot-eye">
              <path d={EYE} className="fill-m-ic-glyph" />
              <g data-pupil data-flip={-side} className="transition-transform duration-300 ease-(--ease-out)">
                <path d={IRIS} className="fill-m-pupil" />
                <path d={STAR_EYE} transform="translate(0.1 0.1) scale(0.22)" className="fill-m-ic-glyph" />
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

/**
 * Волосы Инвиктии — кружочки вокруг головы, отдельно от неё (как на наброске). Координаты головы.
 * Каждый кружок покачивается по-своему (.mascot-hair-x/-y, своя амплитуда, темп и задержка) — волосы «живые».
 */
const HAIR: { el: React.ReactElement; dx: number; dy: number; dur: number; delay: number }[] = [
  { el: <ellipse cx={-8.9} cy={-6.2} rx={2.2} ry={2.9} transform="rotate(35 -8.9 -6.2)" />, dx: -0.63, dy: -0.9, dur: 3.2, delay: 0 },
  { el: <ellipse cx={8.2} cy={-6.3} rx={1.6} ry={1.4} />, dx: 0.72, dy: -0.72, dur: 2.7, delay: -0.9 },
  { el: <circle cx={9.8} cy={-2.2} r={1.2} />, dx: 0.9, dy: 0.36, dur: 2.3, delay: -1.6 },
  { el: <ellipse cx={9.6} cy={0.9} rx={0.45} ry={0.6} />, dx: 0.54, dy: 0.81, dur: 1.9, delay: -0.4 },
  { el: <ellipse cx={-10.5} cy={-1.3} rx={1} ry={0.85} />, dx: -0.9, dy: 0.27, dur: 2.5, delay: -1.2 },
  { el: <ellipse cx={-10.1} cy={2.3} rx={0.55} ry={1} transform="rotate(-15 -10.1 2.3)" />, dx: -0.54, dy: 0.9, dur: 2.1, delay: -0.7 },
];

export function InvictusHair() {
  return (
    <g className="fill-brand-fill">
      {HAIR.map((h, i) => (
        // Горизонталь и вертикаль качаются с разным темпом: кружок описывает мягкую петлю, а не ходит туда-обратно.
        <g key={i} className="mascot-hair-x" style={{ "--hx": `${h.dx}px`, animationDuration: `${h.dur * 1.6}s`, animationDelay: `${h.delay}s` } as React.CSSProperties}>
          <g className="mascot-hair-y" style={{ "--hy": `${h.dy}px`, animationDuration: `${h.dur * 2.1}s`, animationDelay: `${h.delay * 1.7}s` } as React.CSSProperties}>
            {h.el}
          </g>
        </g>
      ))}
    </g>
  );
}

/**
 * Инвиктия — маскот помощника (она) (docs/design/MASCOT.md, набросок NursuUwU 14.11): синяя голова со звездой на лбу,
 * глаза-миндалины с ресницами и звёздами-зрачками, волосы-кружочки вокруг. Только голова: тело — лишь там, где
 * хватает места для полноценного арта. Голова парит над линией маршрута, низ — на y = 10.
 */
function Invictus() {
  return (
    <g transform="translate(0 2)">
      <InvictusHair />
      <circle r={8} strokeWidth={1} className="fill-brand-fill stroke-m-floor" />
      <InvictusFace />
    </g>
  );
}

/** Фигурка на маршруте. Анимация шага — в классах mascot-*, их выключает prefers-reduced-motion (globals.css). */
export function MascotFigure() {
  // Масштаб вокруг низа головы (0, 10): так она стоит на линии маршрута.
  return (
    <g transform="translate(0 10) scale(1.05) translate(0 -10)">
      <Invictus />
    </g>
  );
}

/** Портрет для окна помощника: отдельный SVG, неподвижный (.mascot-still), плотная рамка — голова с волосами заполняет значок. */
export function MascotIcon({ size = 40 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="-12.5 -11.5 25 25" className="mascot-still shrink-0 overflow-visible">
      <MascotFigure />
    </svg>
  );
}
