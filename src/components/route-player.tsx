"use client";

import { ArrowLeft, ArrowRight, ArrowUp, CornerUpLeft, CornerUpRight, DoorOpen, Flag, LogIn, type LucideIcon, RotateCcw, Undo2, X } from "lucide-react";
import Link from "next/link";
import { createContext, type KeyboardEvent, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import type { Pt } from "@/lib/campus/plans";
import { climbEnd, climbStart, type RouteLeg, type RouteStep, type StepKind } from "@/lib/campus/route";
import { type Skin, type SkinId, skinById } from "@/lib/invictia/skins";
import { MascotFigure } from "./mascots";
import { Stairs } from "./stairs-icon";

// Маршрут по шагам (docs/plans/indoor-route.md): «Дальше» листает шаги, схема сама переключает этаж и плавно
// подводит камеру к текущему участку, участок рисуется с анимацией. Без анимаций при prefers-reduced-motion.

export type RouteData = { legs: RouteLeg[]; steps: RouteStep[]; meters: number };
type View = { w: number; h: number };
type Ctx = {
  route: RouteData;
  views: Record<number, View>;
  step: number;
  setStep: (i: number) => void;
  shown: number;
  showFloor: (f: number | null) => void;
  calm: boolean;
  skin: Skin;
};


const RouteCtx = createContext<Ctx | null>(null);
const useRoute = () => useContext(RouteCtx);

function useReducedMotion() {
  const [calm, setCalm] = useState(true); // до гидрации без анимаций
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setCalm(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return calm;
}

/** Состояние плеера для схемы и шагов. Без маршрута (route = null) просто отдаёт содержимое. */
export function RouteProvider({ route, views, skinId, children }: { route: RouteData | null; views: Record<number, View>; skinId: SkinId; children: ReactNode }) {
  const [step, setStepRaw] = useState(0);
  const [manual, setManual] = useState<number | null>(null);
  const calm = useReducedMotion();
  if (!route) return children;
  const last = route.steps.length - 1;
  const setStep = (i: number) => {
    setStepRaw(Math.max(0, Math.min(last, i)));
    setManual(null); // у шага свой этаж
  };
  const current = Math.min(step, last);
  const shown = manual ?? route.steps[current].floor;
  return <RouteCtx value={{ route, views, step: current, setStep, shown, showFloor: setManual, calm, skin: skinById(skinId) }}>{children}</RouteCtx>;
}

/** Схема этажа видна, только когда на нём шаг (или этаж выбран вручную). Схемы всех этажей отрисованы сервером. */
export function RouteFloor({ floor, children }: { floor: number; children: ReactNode }) {
  const ctx = useRoute();
  return <div hidden={!!ctx && ctx.shown !== floor}>{children}</div>;
}

export function RouteFloorTabs({ floors }: { floors: number[] }) {
  const ctx = useRoute();
  if (!ctx) return null;
  return (
    <nav aria-label="Этаж" className="mb-3 flex gap-1.5">
      {floors.map((f) => {
        const on = f === ctx.shown;
        const onRoute = ctx.route.legs.some((l) => l.floor === f);
        return (
          <button
            key={f}
            type="button"
            onClick={() => ctx.showFloor(f === ctx.route.steps[ctx.step].floor ? null : f)}
            aria-pressed={on}
            className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-semibold tabular-nums transition-colors ${
              on ? "bg-brand-fill text-on-brand" : "bg-surface text-ink ring-1 ring-hairline hover:bg-fill/70"
            }`}
          >
            {f} эт.
            {onRoute && !on && <span aria-hidden className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand" />}
            {onRoute && <span className="sr-only">, есть участок маршрута</span>}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Слой на схеме ─────────────────────────────────────────────────────────────────────────────────────────
const f1 = (n: number) => n.toFixed(1);
/**
 * Линия маршрута со скруглёнными поворотами: на каждом изломе — дуга радиусом до 14 (не больше половины соседних
 * отрезков). По этой же линии идёт попутчик.
 */
function curve(pts: Pt[], r = 14) {
  if (pts.length < 3) return `M${pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join("L")}`;
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, v, b] = [pts[i - 1], pts[i], pts[i + 1]];
    const la = Math.hypot(v[0] - a[0], v[1] - a[1]);
    const lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const k = Math.min(r, la / 2, lb / 2);
    const p1: Pt = [v[0] - ((v[0] - a[0]) * k) / la, v[1] - ((v[1] - a[1]) * k) / la];
    const p2: Pt = [v[0] + ((b[0] - v[0]) * k) / lb, v[1] + ((b[1] - v[1]) * k) / lb];
    d += `L${f1(p1[0])},${f1(p1[1])}Q${f1(v[0])},${f1(v[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  const z = pts.at(-1)!;
  return `${d}L${f1(z[0])},${f1(z[1])}`;
}
const lengthOf = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

const FRAME = 4 / 3; // кадр схемы в режиме маршрута (CampusMap wide)

/** Рамка камеры: участок шага с полями, не уже 55% схемы, в пропорциях кадра 4:3 и по возможности в пределах схемы. */
function focusBox(pts: Pt[], v: View): [number, number, number, number] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [cx, cy] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const h = Math.max(Math.max(...ys) - Math.min(...ys) + 120, Math.max(Math.max(...xs) - Math.min(...xs) + 120, v.w * 0.55) / FRAME);
  const w = h * FRAME;
  // Длинный участок может не влезть в кадр целиком: тогда кадр больше схемы и центрирован (поля — подложка).
  const x = w >= v.w ? (v.w - w) / 2 : Math.min(Math.max(cx - w / 2, 0), v.w - w);
  const y = h >= v.h ? (v.h - h) / 2 : Math.min(Math.max(cy - h / 2, 0), v.h - h);
  return [x, y, w, h];
}

/**
 * Инвиктия на схеме: проходит участок шага один раз (animateMotion по той же скруглённой линии) и остаётся в конце,
 * покачиваясь; на лестнице прыгает, у двери радуется. Парит над линией маршрута.
 * Родитель пересоздаёт его на каждом шаге (key), так что проход начинается заново только при смене шага.
 */
function Walker({ skin, at, motion, mood, finale = false }: { skin: Skin; at?: Pt; motion?: { d: string; dur: number }; mood: "walk" | "hop" | "still"; finale?: boolean }) {
  const group = useRef<SVGGElement>(null);
  const anim = useRef<SVGAnimateMotionElement>(null);
  const [arrived, setArrived] = useState(!motion);
  useEffect(() => {
    const a = anim.current;
    const g = group.current;
    if (!a || !g) return;
    const end = () => setArrived(true);
    a.addEventListener("endEvent", end);
    a.beginElement(); // begin="indefinite": SMIL-время документа давно ушло, запускаем вручную
    g.style.visibility = "visible"; // до запуска фигурка стояла бы в углу схемы
    return () => a.removeEventListener("endEvent", end);
  }, []);
  // Пришёл к двери — радуется, звезда-глаз загорается зелёным, как лампочка.
  const pose = finale ? "cheer" : motion ? (arrived ? "idle" : "walk") : mood;
  const lit = finale;
  return (
    <g ref={group} transform={at ? `translate(${f1(at[0])} ${f1(at[1])})` : undefined} style={motion ? { visibility: "hidden" } : undefined}>
      {motion && <animateMotion ref={anim} begin="indefinite" dur={`${motion.dur.toFixed(2)}s`} fill="freeze" calcMode="paced" path={motion.d} />}
      {/* На схеме чуть меньше натурального размера: коридор узкий. Масштаб вокруг ступней. */}
      <g transform="translate(0 -8) translate(0 10) scale(0.8) translate(0 -10)">
        {/* Тень под ногами и обводка цветом пола: не сливается с линией маршрута и выбранной аудиторией. */}
        <ellipse cy={10.6} rx={7} ry={1.7} className="fill-ink opacity-20" />
        <g className={`mascot-sticker ${pose === "still" ? "" : `mascot-${pose}`} ${lit ? "mascot-lit" : ""}`}>
          <MascotFigure skin={skin} />
        </g>
      </g>
    </g>
  );
}

export function RouteLayer({ floor }: { floor: number }) {
  const ctx = useRoute();
  const ref = useRef<SVGGElement>(null);
  const frame = useRef(0);
  const view = ctx?.views[floor];
  const step = ctx?.step ?? 0;
  const shown = ctx?.shown;
  const current = ctx?.route.steps[step];

  // Камера: плавно к участку текущего шага (или вся схема, если этаж выбран вручную).
  useEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg || !view || shown !== floor || !current) return;
    const target = current.floor === floor ? focusBox(current.path, view) : ([0, 0, view.w, view.h] as const);
    const from = svg.viewBox.baseVal;
    const start = [from.x, from.y, from.width, from.height];
    cancelAnimationFrame(frame.current);
    if (ctx?.calm) {
      svg.setAttribute("viewBox", target.join(" "));
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 550);
      const e = 1 - (1 - k) ** 3;
      svg.setAttribute("viewBox", start.map((s, i) => s + (target[i] - s) * e).join(" "));
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [step, shown, floor, view, current, ctx?.calm]);
  // Фокус с клавиатуры на аудитории за кадром: показываем этаж целиком, чтобы выбранное было видно.
  useEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg || !view) return;
    const onFocus = (e: FocusEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("a")) return;
      cancelAnimationFrame(frame.current);
      svg.setAttribute("viewBox", `0 0 ${view.w} ${view.h}`);
    };
    svg.addEventListener("focusin", onFocus);
    return () => svg.removeEventListener("focusin", onFocus);
  }, [view]);
  // Маршрут закрыли: схема снова целиком.
  useEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    const v = view;
    return () => {
      cancelAnimationFrame(frame.current);
      if (svg && v) svg.setAttribute("viewBox", `0 0 ${v.w} ${v.h}`);
    };
  }, [view]);

  if (!ctx || !current) return null;
  const { route, calm, skin } = ctx;
  const steps = route.steps.map((s, i) => ({ ...s, i })).filter((s) => s.floor === floor);
  const legs = route.legs.map((l, i) => ({ ...l, i })).filter((l) => l.floor === floor);
  const pill = (at: Pt, text: string) => {
    const width = text.length * 6.2 + 12;
    const x = Math.min(Math.max(at[0] - width / 2, 4), (view?.w ?? 440) - width - 4);
    return (
      <g>
        <rect x={x} y={at[1] + 7} width={width} height={16} rx={8} className="fill-brand-fill" />
        <text x={x + width / 2} y={at[1] + 18.5} textAnchor="middle" fontSize={10} className="fill-on-brand font-semibold">
          {text}
        </text>
      </g>
    );
  };

  return (
    <g ref={ref} aria-hidden pointerEvents="none">
      {/* Весь путь по этажу пунктиром, повороты скруглены. */}
      {legs.map((l) =>
        l.points.length > 1 ? <path key={`w${l.i}`} d={curve(l.points)} strokeWidth={2.5} strokeDasharray="5 5" strokeLinecap="round" className="fill-none stroke-brand opacity-50" /> : null,
      )}
      {/* Пройденные шаги сплошной линией. */}
      {steps
        .filter((s) => s.i < step && s.path.length > 1)
        .map((s) => (
          <path key={`p${s.i}`} d={curve(s.path)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="fill-none stroke-brand" />
        ))}
      {/* Текущий шаг: подложка и линия, которая «прорисовывается». */}
      {current.floor === floor && current.path.length > 1 && (
        <g key={`c${step}`}>
          <path d={curve(current.path)} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" className="fill-none stroke-brand-soft" />
          <path d={curve(current.path)} pathLength={1} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className={`fill-none stroke-brand ${calm ? "" : "route-draw"}`} />
        </g>
      )}
      {current.floor === floor && current.path.length === 1 && (
        <circle key={`d${step}`} cx={current.path[0][0]} cy={current.path[0][1]} r={8} strokeWidth={3} className={`fill-brand-soft stroke-brand ${calm ? "" : "route-pulse"}`} />
      )}
      {/* Старт, финиш и лестницы. Подписи этажа — под точкой: над ней стоит попутчик. */}
      {legs.map(({ points, i }) => {
        const last = route.legs.length - 1;
        const pass = points.length <= 1 && i > 0 && i < last;
        return (
          <g key={`m${i}`}>
            {i === 0 && <circle cx={points[0][0]} cy={points[0][1]} r={5.5} strokeWidth={2} className="fill-brand stroke-m-floor" />}
            {i === last && <circle cx={points.at(-1)![0]} cy={points.at(-1)![1]} r={4.5} strokeWidth={2.5} className="fill-m-floor stroke-brand" />}
            {pass && pill(points[0], `дальше на ${climbEnd(route.legs, i + 1)} эт.`)}
            {!pass && i > 0 && pill(points[0], `с ${climbStart(route.legs, i - 1)} эт.`)}
            {!pass && i < last && pill(points.at(-1)!, `на ${climbEnd(route.legs, i + 1)} эт.`)}
          </g>
        );
      })}
      {/* Попутчик — последним, поверх линий и подписей. key: новый шаг или смена режима анимации — проход заново. */}
      {current.floor === floor && (
        <g key={`w${step}-${calm ? "calm" : "move"}`}>
          {current.path.length === 1 ? (
            <Walker skin={skin} at={current.path[0]} mood={calm ? "still" : "hop"} />
          ) : current.kind === "arrive" ? (
            // Финиш: стоит в коридоре напротив двери (а не в проёме) и «загорается».
            <Walker skin={skin} at={current.path[0]} mood="still" finale />
          ) : calm ? (
            <Walker skin={skin} at={current.path.at(-1)!} mood="still" />
          ) : (
            <Walker skin={skin} motion={{ d: curve(current.path), dur: Math.max(1.4, lengthOf(current.path) / 70) }} mood="walk" />
          )}
        </g>
      )}
    </g>
  );
}

// ─── Плеер под схемой ───────────────────────────────────────────────────────────────────────────────────────
const ICON: Record<Exclude<StepKind, "start">, LucideIcon> = { straight: ArrowUp, left: CornerUpLeft, right: CornerUpRight, back: Undo2, up: Stairs, down: Stairs, arrive: Flag };

export function RoutePlayer({ target, fromEntrance, closeHref, origins, other }: { target: string; fromEntrance: boolean; closeHref: string; origins: ReactNode; other: ReactNode }) {
  const ctx = useRoute();
  if (!ctx) return null;
  const { route, step, setStep, calm } = ctx;
  const s = route.steps[step];
  const last = route.steps.length - 1;
  const Icon = s.kind === "start" ? (fromEntrance ? LogIn : DoorOpen) : ICON[s.kind];
  const onKey = (e: KeyboardEvent) => {
    // Стрелки листают шаги, но не мешают печатать в поле «Из другой аудитории» и не трогают сочетания клавиш.
    const t = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || t.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "ArrowRight") setStep(step + 1);
    else if (e.key === "ArrowLeft") setStep(step - 1);
    else return;
    e.preventDefault();
  };

  return (
    <section data-route-player aria-label={`Как пройти к аудитории ${target}`} onKeyDown={onKey} className="mt-3 rounded-3xl bg-surface p-4 ring-1 ring-hairline md:p-5">
      {/* Сразу под схемой: текущий шаг и кнопки, чтобы на телефоне схема, шаг и «Дальше» были на одном экране. */}
      <div className="flex items-start gap-3">
        {/* Живая область постоянная: диктор объявляет новый шаг; ключ для анимации — на содержимом. */}
        <div aria-live="polite" aria-atomic="true" className="min-w-0 flex-1">
        <div key={step} className={`flex items-start gap-3 ${calm ? "" : "route-step-in"}`}>
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Icon className={`size-6 ${s.kind === "down" ? "-scale-x-100" : ""}`} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-2">
              Шаг {step + 1} из {route.steps.length} · {s.floor} этаж
            </p>
            <p className="text-lead leading-snug font-semibold">{s.text}</p>
            {s.meters ? <p className="text-sm text-ink-2">около {s.meters}&nbsp;м</p> : null}
          </div>
        </div>
        </div>
        <Link href={closeHref} replace scroll={false} aria-label="Закрыть маршрут" className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-fill">
          <X aria-hidden className="size-5" />
        </Link>
      </div>

      <div aria-hidden className="mt-3 flex gap-1">
        {route.steps.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-brand" : "bg-fill"}`} />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-4 text-body font-semibold text-ink ring-1 ring-hairline transition active:scale-95 disabled:text-ink-3"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Назад
        </button>
        {step < last ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-fill px-4 text-body font-semibold text-on-brand transition active:scale-[0.98]"
          >
            Дальше
            <ArrowRight aria-hidden className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep(0)}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-soft px-4 text-body font-semibold text-brand transition active:scale-[0.98]"
          >
            <RotateCcw aria-hidden className="size-4" />
            Сначала
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-hairline pt-3">
        <h2 className="font-semibold">Как пройти к аудитории {target}</h2>
        <p className="text-sm text-ink-2">Около {route.meters}&nbsp;м. Путь и расстояния примерные.</p>
        {origins}
      </div>

      {/* Все шаги списком: текстовая версия маршрута и быстрый переход к любому шагу. */}
      <details className="group mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-brand">Все шаги</summary>
        <ol className="mt-1 space-y-1">
          {route.steps.map((st, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm transition-colors ${i === step ? "bg-brand-soft font-semibold text-brand" : "hover:bg-fill"}`}
              >
                <span className="w-6 shrink-0 text-ink-2 tabular-nums">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  {st.text}
                  {st.meters ? <span className="font-normal text-ink-2">, около {st.meters}&nbsp;м</span> : null}
                </span>
                <span className="shrink-0 text-xs text-ink-2">{st.floor} эт.</span>
              </button>
            </li>
          ))}
        </ol>
      </details>
      {other}
    </section>
  );
}
