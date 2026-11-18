// Инвиктия в полный рост для пустых экранов и экранов ошибок (галерея сцен, наброски NursuUwU, 18.11).
// Статичные рисунки: тело — один силуэт с ногами, голова парит чуть выше, руки-варежки отдельно; лицо и волосы —
// из mascots.tsx. Координаты головы: центр (0, 0), радиус 8; ступни — на y ≈ 25. Все цвета — токены темы.
import { EYE, InvictusHair, IRIS, LASHES, LINER, STAR_EYE } from "./mascots";

export type SceneName = "notfound" | "error" | "today" | "notifications" | "requests" | "search";

type Pt = readonly [number, number];

/** Открытый глаз; look — куда смотрит зрачок, в координатах головы. */
function Eye({ side, look = [0, 0] }: { side: -1 | 1; look?: Pt }) {
  const sx = -side * 1.3;
  return (
    <g transform={`translate(${side * 3.3} 1.8) scale(${sx} 1.3)`}>
      <path d={EYE} className="fill-m-ic-glyph" />
      <g transform={`translate(${look[0] / sx} ${look[1] / 1.3})`}>
        <path d={IRIS} className="fill-m-pupil" />
        <path d={STAR_EYE} transform="translate(0.1 0.1) scale(0.22)" className="fill-m-ic-glyph" />
      </g>
      <path d={LINER} strokeWidth={0.55} strokeLinecap="round" className="fill-none stroke-m-pupil" />
      <path d={LASHES} transform="translate(-2.1 -1.8) scale(0.75) translate(2.1 1.8)" strokeWidth={0.25} strokeLinejoin="round" className="fill-m-pupil stroke-m-pupil" />
    </g>
  );
}

const HAPPY = "M-5.6 2.6Q-3.5 -0.4 -1.4 2.6M1.4 2.6Q3.5 -0.4 5.6 2.6";
const HAPPY_LASH = "M-5.2 2Q-5.7 1.6 -6.1 1.2M-5.6 2.6Q-6.1 2.55 -6.5 2.35M5.2 2Q5.7 1.6 6.1 1.2M5.6 2.6Q6.1 2.55 6.5 2.35";

/** Весёлые закрытые «^ ^» с ресничками — как .mascot-joy на кнопке помощника. */
const HappyEyes = () => (
  <>
    <path d={HAPPY} strokeWidth={1.2} strokeLinecap="round" className="fill-none stroke-m-pupil" />
    <path d={HAPPY_LASH} strokeWidth={0.55} strokeLinecap="round" className="fill-none stroke-m-pupil" />
  </>
);

/** Голова: волосы, круг с обводкой цветом пола (как на маршруте), звезда на лбу; лицо — children. */
function Head({ y = 0.8, tilt = 0, children }: { y?: number; tilt?: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(0 ${y}) rotate(${tilt})`}>
      <InvictusHair />
      <circle r={8} strokeWidth={1} className="fill-brand-fill stroke-m-floor" />
      <path d={STAR_EYE} transform="translate(0 -5.6) scale(0.42)" className="fill-on-brand" />
      {children}
    </g>
  );
}

// Силуэт с наброска: плечи, плавная талия, бёдра и ноги одной линией; сидя — ноги короче (бедро в ракурсе).
const BODY =
  "M-3.4 10.1Q0 9.33 3.4 10.1Q5.2 10.62 5.1 12.42C5.1 13.71 3.75 14.23 3.75 15.43C3.75 16.64 6.1 17.15 6.1 19.05Q6.3 21.63 5.6 23.69Q5.2 25.41 3.1 25.41Q1.1 25.41 0.8 23.69L0.5 21.45Q0 20.94 -0.5 21.45L-0.8 23.69Q-1.1 25.41 -3.1 25.41Q-5.2 25.41 -5.6 23.69Q-6.3 21.63 -6.1 19.05C-6.1 17.15 -3.75 16.64 -3.75 15.43C-3.75 14.23 -5.1 13.71 -5.1 12.42Q-5.2 10.62 -3.4 10.1Z";
const BODY_SIT =
  "M-3.4 10.1Q0 9.33 3.4 10.1Q5.2 10.62 5.1 12.42C5.1 13.71 3.75 14.23 3.75 15.43C3.75 16.64 6.1 17.15 6.1 19.05Q6.3 20.77 5.8 22.14Q5.4 23.52 3.2 23.52Q1.1 23.52 0.8 22.14L0.5 21.11Q0 20.59 -0.5 21.11L-0.8 22.14Q-1.1 23.52 -3.2 23.52Q-5.4 23.52 -5.8 22.14Q-6.3 20.77 -6.1 19.05C-6.1 17.15 -3.75 16.64 -3.75 15.43C-3.75 14.23 -5.1 13.71 -5.1 12.42Q-5.2 10.62 -3.4 10.1Z";
/** Белые полоски «сапожек». */
const BOOTS = "M0.75 22.49Q3.2 23.35 5.95 22.4M-0.75 22.49Q-3.2 23.35 -5.95 22.4";
const BOOTS_SIT = "M0.75 21.28Q3.2 22.06 6.05 21.2M-0.75 21.28Q-3.2 22.06 -6.05 21.2";

function Body({ lean = 0, y = 0, sit = false }: { lean?: number; y?: number; sit?: boolean }) {
  return (
    <g transform={`translate(0 ${y}) rotate(${lean} 0 18)`}>
      <path d={sit ? BODY_SIT : BODY} strokeWidth={0.9} strokeLinejoin="round" className="fill-brand-fill stroke-m-floor" />
      <path d={sit ? BOOTS_SIT : BOOTS} strokeWidth={0.6} strokeLinecap="round" className="fill-none stroke-on-brand" />
      <path d={STAR_EYE} transform="translate(0 12.7) scale(0.44 0.48)" className="fill-on-brand" />
    </g>
  );
}

/** Рука-варежка — кружок отдельно от тела; motion — дуги движения («))» на наброске) с этой стороны. */
function Hand({ x, y, motion = 0 }: { x: number; y: number; motion?: -1 | 0 | 1 }) {
  return (
    <>
      {motion !== 0 && (
        <path
          d={`M${x + motion * 3.6} ${y - 2.4}Q${x + motion * 4.8} ${y} ${x + motion * 3.6} ${y + 2.4}M${x + motion * 5.2} ${y - 1.4}Q${x + motion * 6} ${y} ${x + motion * 5.2} ${y + 1.4}`}
          strokeWidth={0.7}
          strokeLinecap="round"
          className="fill-none stroke-brand-fill"
        />
      )}
      <circle cx={x} cy={y} r={2.6} strokeWidth={0.8} className="fill-brand-fill stroke-m-floor" />
    </>
  );
}

const Sparkle = ({ x, y, s, className = "fill-m-ic-book" }: { x: number; y: number; s: number; className?: string }) => (
  <path d={STAR_EYE} transform={`translate(${x} ${y}) scale(${s})`} className={className} />
);

function Question({ x, y, k, className }: { x: number; y: number; k: number; className: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path d="M-1.9 -1.6Q-1.9 -4.2 0.4 -4.2Q2.6 -4.2 2.6 -2.2Q2.6 -0.8 1 0Q0.2 0.5 0.2 1.6" strokeWidth={1.3} strokeLinecap="round" className={`fill-none ${className}`} />
      <circle cx={0.2} cy={3.6} r={0.85} className={className.replace("stroke-", "fill-")} />
    </g>
  );
}

/** Страница не найдена: маршрут на схеме ведёт к комнате, которой нет, — пунктир и «?». */
function NotFound() {
  return (
    <>
      <Body />
      <g transform="translate(0 16.6) rotate(-4)">
        <rect x={-10.4} y={-5.6} width={20.8} height={11.2} rx={1} strokeWidth={0.6} className="fill-surface stroke-ink-3/60" />
        <path d="M-8.8 -0.6V-4.2H-3.6V-0.6M-2.4 -0.6V-4.2H2.4V-0.6" strokeWidth={0.55} strokeLinejoin="round" className="fill-none stroke-ink-3/45" />
        <path d="M-8.8 -0.6H-6.8M-5.6 -0.6H-2.8M-1.6 -0.6H0.4M1.6 -0.6H3.6M8.8 -0.6V4.2H-8.8V-0.6" strokeWidth={0.55} className="fill-none stroke-ink-3/45" />
        <rect x={3.6} y={-4.2} width={5.2} height={3.6} rx={0.4} strokeWidth={0.55} strokeDasharray="1 .8" className="fill-brand-soft stroke-brand" />
        <Question x={6.2} y={-2.5} k={0.38} className="stroke-brand" />
        <path d="M-6.6 2.2H6.2V-0.2" strokeWidth={0.7} strokeDasharray="1.1 .9" strokeLinecap="round" strokeLinejoin="round" className="fill-none stroke-k-language" />
        <circle cx={-7.2} cy={2.2} r={1.1} className="fill-k-language" />
        <circle cx={-7.2} cy={2.2} r={0.4} className="fill-surface" />
      </g>
      <Hand x={-11} y={15.4} />
      <Hand x={10.8} y={14.4} />
      <Head tilt={16}>
        <Eye side={-1} look={[-0.1, 0.65]} />
        <Eye side={1} look={[-0.1, 0.65]} />
      </Head>
      <Question x={13.5} y={-12.5} k={0.8} className="stroke-brand" />
      <Sparkle x={-15} y={-9} s={0.3} className="fill-brand" />
    </>
  );
}

/** Раздел не загрузился: чинит — выдернутая вилка в одной руке, гаечный ключ в другой. */
function Repair() {
  return (
    <>
      <Body lean={-3} />
      <path d="M-12.4 16.6Q-14 28 -4 29.6Q6 31 9.8 22.6" strokeWidth={1.1} strokeLinecap="round" className="fill-none stroke-ink-3" />
      <g transform="translate(-12.4 13.4) rotate(-18)" className="fill-ink-3 stroke-ink-3">
        <rect x={-2.2} y={-1.4} width={4.4} height={3.6} rx={1} strokeWidth={0} />
        <path d="M-1 -1.4V-3.6M1 -1.4V-3.6" strokeWidth={0.7} strokeLinecap="round" />
      </g>
      <g transform="translate(11.2 21.2) rotate(30)">
        <rect x={-2.1} y={-2.6} width={4.2} height={3.6} rx={1} className="fill-ink-3" />
        <circle cx={-0.8} cy={-1.2} r={0.4} className="fill-surface" />
        <circle cx={0.8} cy={-1.2} r={0.4} className="fill-surface" />
      </g>
      <Hand x={-12.6} y={15.6} />
      <g transform="translate(13.6 9.4) rotate(28)">
        <rect x={-1.05} y={-9.4} width={2.1} height={10.4} rx={1.05} className="fill-ink-3" />
        <circle cy={-11} r={3} className="fill-ink-3" />
        <rect x={-1.15} y={-15} width={2.3} height={4.2} rx={0.5} className="fill-surface" />
      </g>
      <Hand x={13.6} y={9.4} />
      <Head tilt={-8}>
        <Eye side={-1} look={[0.5, 0.55]} />
        <Eye side={1} look={[0.5, 0.55]} />
      </Head>
    </>
  );
}

function Book({ x, y, w, color }: { x: number; y: number; w: number; color: string }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={3.2} rx={0.8} className={color} />
      <rect x={x + w - 2.6} y={y + 0.6} width={2} height={2} rx={0.4} className="fill-surface" />
      <path d={`M${x + 1.6} ${y + 1.6}H${x + w - 4.4}`} strokeWidth={0.45} strokeLinecap="round" className="stroke-surface opacity-55" />
    </>
  );
}

const STEAM = ["M-1.6 11Q-2.4 9.4 -1.6 8Q-.8 6.6 -1.6 5", "M0.4 10.6Q-0.4 9 0.4 7.6Q1.2 6.2 0.4 4.6", "M2.4 11Q1.6 9.4 2.4 8Q3.2 6.6 2.4 5"];

/** Сегодня пар нет: сидит на стопке учебников с кружкой чая — держит за ручку, глаза «^ ^». */
function Rest() {
  return (
    <>
      <g transform="translate(0 -1.7)">
        <ellipse cx={0} cy={31.4} rx={14.6} ry={1.3} className="fill-brand-soft" />
        <Book x={-11.4} y={27.8} w={22.6} color="fill-k-language" />
        <Book x={-12.6} y={24.6} w={24.4} color="fill-k-sport" />
        <Book x={-11.8} y={21.4} w={23} color="fill-k-consult" />
      </g>
      <Body y={-0.6} sit />
      <Hand x={-9.6} y={19.2} />
      <Hand x={7.4} y={12.4} />
      {/* Ручка кружки рисуется поверх варежки: рука держит её за ручку. */}
      <g transform="translate(12.6 11.4)">
        <path d="M-3.4 -2.6H3.4V2.6Q3.4 4.6 1.4 4.6H-1.4Q-3.4 4.6 -3.4 2.6Z" className="fill-k-language" />
        <path d={STAR_EYE} transform="translate(0 1) scale(0.3)" className="fill-surface" />
        <path d="M-3.2 -1.2Q-5.6 -1.2 -5.6 0.8Q-5.6 2.8 -3.2 2.6" strokeWidth={1} strokeLinecap="round" className="fill-none stroke-k-language" />
      </g>
      <g transform="translate(12.2 -2.6)" strokeWidth={0.7} strokeLinecap="round" className="fill-none stroke-ink-3">
        {STEAM.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <Head y={-0.2} tilt={9}>
        <HappyEyes />
      </Head>
      <Sparkle x={-15.5} y={-9} s={0.4} />
      <Sparkle x={-18} y={2} s={0.24} />
      <Sparkle x={19.5} y={-6} s={0.26} />
    </>
  );
}

/** Уведомлений нет: вытряхивает перевёрнутый конверт — оттуда только пылинки. */
function EmptyEnvelope() {
  return (
    <>
      <Body lean={4} />
      <g transform="translate(15 4.4) scale(1.12)" strokeWidth={0.6} strokeLinejoin="round">
        <rect x={-5.4} y={-3.6} width={10.8} height={7.2} rx={0.8} className="fill-surface stroke-ink-3/60" />
        <path d="M-5.2 3.4L0 -0.8L5.2 3.4" className="fill-none stroke-ink-3/60" />
        <path d="M-5.4 3.6L0 8.2L5.4 3.6Z" className="fill-brand-soft stroke-brand" />
      </g>
      <circle cx={14.2} cy={16.4} r={0.55} className="fill-ink-3" />
      <circle cx={16.4} cy={18.6} r={0.4} className="fill-ink-3 opacity-70" />
      <circle cx={14.8} cy={21.2} r={0.3} className="fill-ink-3 opacity-45" />
      <path d="M22 -1.4Q23.4 1.6 22 4.6M24 0Q24.9 1.6 24 3.2" strokeWidth={0.7} strokeLinecap="round" className="fill-none stroke-brand-fill" />
      <Hand x={10} y={0.6} />
      <Hand x={-8.6} y={16.8} />
      <Head tilt={10}>
        <Eye side={-1} look={[0.6, 0.2]} />
        <Eye side={1} look={[0.6, 0.2]} />
      </Head>
    </>
  );
}

/** Заявок нет: радостно протягивает справку со звёздной печатью — первый шаг. */
function Offer() {
  return (
    <>
      <Body lean={4} />
      <g transform="translate(14 3) rotate(12)" strokeWidth={0.6} strokeLinejoin="round">
        <path d="M-5 -7H2.6L5 -4.6V7H-5Z" className="fill-surface stroke-ink-3/60" />
        <path d="M2.6 -7V-4.6H5" className="fill-none stroke-ink-3/60" />
        <path d="M-3.2 -3.8H1.2M-3.2 -1.6H3.2M-3.2 0.6H3.2M-3.2 2.8H0" strokeWidth={0.7} strokeLinecap="round" className="stroke-ink-3/45" />
        <circle cx={2.4} cy={4.6} r={1.9} strokeWidth={0} className="fill-k-consult" />
        <path d={STAR_EYE} transform="translate(2.4 4.6) scale(0.28)" strokeWidth={0} className="fill-surface" />
      </g>
      <Hand x={10.4} y={9.6} />
      <Hand x={-9.4} y={16} />
      <Head tilt={6}>
        <HappyEyes />
      </Head>
      <Sparkle x={21.5} y={-6.5} s={0.38} />
      <Sparkle x={23} y={9} s={0.26} />
      <Sparkle x={8.5} y={-11} s={0.24} />
    </>
  );
}

/** Аудитория не найдена: ищет с лупой — глаз под стеклом крупный, второй прищурен. */
function Search() {
  return (
    <>
      <Body lean={-3} />
      <Hand x={-5.4} y={11.4} />
      <Hand x={11.8} y={11.8} />
      <Head tilt={-5}>
        <path d="M-5.6 2.2Q-3.5 1.2 -1.4 2.2" strokeWidth={1.2} strokeLinecap="round" className="fill-none stroke-m-pupil" />
        <path d="M-5.6 2.2Q-6.1 1.9 -6.5 1.4" strokeWidth={0.55} strokeLinecap="round" className="fill-none stroke-m-pupil" />
        <defs>
          <clipPath id="invictia-lens">
            <circle cx={3.4} cy={1.6} r={4.4} />
          </clipPath>
        </defs>
        <path d="M6.6 4.8L11.4 10.4" strokeWidth={2.2} strokeLinecap="round" className="stroke-m-ic-book" />
        <g clipPath="url(#invictia-lens)">
          <circle cx={3.4} cy={1.6} r={4.4} className="fill-brand-fill" />
          <g transform="translate(3.4 1.6) scale(1.65) translate(-3.3 -1.8)">
            <Eye side={1} look={[-0.3, -0.2]} />
          </g>
          <circle cx={3.4} cy={1.6} r={4.4} className="fill-surface opacity-20" />
          <path d="M0.6 -1Q1.6 -2.4 3.2 -2.4" strokeWidth={0.7} strokeLinecap="round" className="fill-none stroke-surface opacity-90" />
        </g>
        <circle cx={3.4} cy={1.6} r={4.4} strokeWidth={1.1} className="fill-none stroke-m-ic-book" />
      </Head>
      <circle cx={-15} cy={-13} r={0.9} className="fill-brand" />
      <circle cx={-18} cy={-8.5} r={0.6} className="fill-brand" />
      <circle cx={-19.5} cy={-3.6} r={0.45} className="fill-brand" />
    </>
  );
}

const SCENES: Record<SceneName, () => React.ReactNode> = {
  notfound: NotFound,
  error: Repair,
  today: Rest,
  notifications: EmptyEnvelope,
  requests: Offer,
  search: Search,
};

/** Декоративная сцена: без неё экран читается так же (aria-hidden). Неподвижна — волосы не качаются (.mascot-still). */
export function InvictiaScene({ name, className = "" }: { name: SceneName; className?: string }) {
  const Scene = SCENES[name];
  return (
    <svg aria-hidden viewBox="-27 -21 54 54" className={`mascot-still h-auto overflow-visible ${className}`}>
      <Scene />
    </svg>
  );
}
