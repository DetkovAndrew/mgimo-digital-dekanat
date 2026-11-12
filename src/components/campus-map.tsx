import { BookOpen, createLucideIcon, DoorOpen, Dumbbell, type LucideIcon, Shirt, Toilet, Utensils } from "lucide-react";
import Link from "next/link";
import { roomKindLabel, type DecorIcon, type Door, type PlanBuilding, type Pt, type RoomKind, type Side } from "@/lib/campus/plans";
import type { RouteLeg, RouteTransfer } from "@/lib/campus/route";

// Схема этажа в стиле поэтажного плана. Подложка серая, коридоры белые, наружные стены толще. Аудитории почти белые,
// у них тонкие общие стены и проём двери в коридор. Тон есть только у особых помещений, значки (цветные квадраты)
// у лестниц, туалетов, столовой. Каждая аудитория является ссылкой на своё расписание и бронь. Размеры в SVG заданы
// в единицах viewBox.

export const ROOM_KIND_STYLE: Record<RoomKind, { fill: string; soft: string }> = {
  LECTURE_HALL: { fill: "fill-m-hall", soft: "bg-m-hall ring-1 ring-inset ring-m-wall" },
  CLASSROOM: { fill: "fill-m-room", soft: "bg-m-room ring-1 ring-inset ring-m-wall" },
  COMPUTER_LAB: { fill: "fill-m-room", soft: "bg-m-room ring-1 ring-inset ring-m-wall" },
  LAB: { fill: "fill-m-room", soft: "bg-m-room ring-1 ring-inset ring-m-wall" },
  COWORKING: { fill: "fill-m-cowork", soft: "bg-m-cowork ring-1 ring-inset ring-m-wall" },
  MEETING: { fill: "fill-m-meet", soft: "bg-m-meet ring-1 ring-inset ring-m-wall" },
};

export const Stairs = createLucideIcon("Stairs", [["path", { d: "M3 20h5v-5h5v-5h5V5h3", key: "stairs" }]]);
const ICON: Record<DecorIcon, LucideIcon> = { toilet: Toilet, stairs: Stairs, food: Utensils, sport: Dumbbell, book: BookOpen, coat: Shirt, entrance: DoorOpen };
const ICON_LABEL: Record<DecorIcon, string> = { toilet: "Туалет", stairs: "Лестница", food: "Столовая", sport: "Спортзал", book: "Библиотека", coat: "Гардероб", entrance: "Вход" };
const BADGE: Record<DecorIcon, string> = {
  toilet: "fill-m-ic-wc",
  stairs: "fill-m-ic-stairs",
  food: "fill-m-ic-food",
  sport: "fill-m-ic-sport",
  book: "fill-m-ic-book",
  coat: "fill-m-ic-coat",
  entrance: "fill-m-ic-exit",
};
const BADGE_BG: Record<DecorIcon, string> = {
  toilet: "bg-m-ic-wc",
  stairs: "bg-m-ic-stairs",
  food: "bg-m-ic-food",
  sport: "bg-m-ic-sport",
  book: "bg-m-ic-book",
  coat: "bg-m-ic-coat",
  entrance: "bg-m-ic-exit",
};
/** Заливка помещения без номера зависит от назначения, как на поэтажных планах. */
const spaceFill = (icon?: DecorIcon) => (icon === "food" ? "fill-m-food" : icon === "toilet" ? "fill-m-wc" : icon === "sport" || icon === "book" ? "fill-m-quiet" : "fill-m-room");

type Box = { x0: number; y0: number; x1: number; y1: number };
const bbox = (p: Pt[]): Box => ({
  x0: Math.min(...p.map((q) => q[0])),
  y0: Math.min(...p.map((q) => q[1])),
  x1: Math.max(...p.map((q) => q[0])),
  y1: Math.max(...p.map((q) => q[1])),
});
const f = (n: number) => n.toFixed(1);
const rectPath = ({ x0, y0, x1, y1 }: Box) => `M${f(x0)},${f(y0)}H${f(x1)}V${f(y1)}H${f(x0)}Z`;

/** Стены помещения; на стороне двери проём там, где его поставила схема (за ним коридор или холл). */
function walls(p: Pt[], door: Door | null | undefined) {
  const { x0, y0, x1, y1 } = bbox(p);
  const line = (side: Side, a0: number, a1: number, fixed: number) => {
    const horizontal = side === "n" || side === "s";
    const seg = (u: number, v: number) => (v - u < 0.1 ? "" : horizontal ? `M${f(u)},${f(fixed)}H${f(v)}` : `M${f(fixed)},${f(u)}V${f(v)}`);
    return door?.side === side ? seg(a0, door.at[0]) + seg(door.at[1], a1) : seg(a0, a1);
  };
  return line("n", x0, x1, y0) + line("s", x0, x1, y1) + line("w", y0, y1, x0) + line("e", y0, y1, x1);
}

/** Подпись помещения 11 единиц, в узком мельче, чтобы не вылезала за стены. */
function labelSize(p: Pt[], label: string) {
  const { x0, x1 } = bbox(p);
  return Math.min(11, (x1 - x0 - 6) / (label.length * 0.58));
}

/** Значок как на планах: цветной скруглённый квадрат с белым знаком. */
function Badge({ icon, at, size = 18 }: { icon: DecorIcon; at: Pt; size?: number }) {
  const I = ICON[icon];
  const g = size * 0.66;
  return (
    <g aria-hidden>
      <rect x={at[0] - size / 2} y={at[1] - size / 2} width={size} height={size} rx={size * 0.24} className={BADGE[icon]} />
      <I x={at[0] - g / 2} y={at[1] - g / 2} width={g} height={g} strokeWidth={2.4} className="text-m-ic-glyph" />
    </g>
  );
}

// Подпись поверх стен: обводка цветом пола отделяет цифры от линий, как на планах.
const HALO = { stroke: "currentColor", strokeWidth: 3, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };

export function CampusMap({
  plan,
  floor,
  busyNow,
  mine,
  selected,
  href,
  route = null,
}: {
  plan: PlanBuilding;
  floor: number;
  busyNow: string[];
  mine: string[];
  selected: string | null;
  href: (number: string) => string;
  route?: { legs: RouteLeg[]; transfers: RouteTransfer[] } | null;
}) {
  const geo = plan.floor(floor);
  const busy = new Set(busyNow);
  const my = new Set(mine);
  const { w } = plan.view;
  const h = geo.h ?? plan.view.h;
  const yards = geo.decor.filter((d) => d.tone === "yard");
  const open = geo.decor.filter((d) => d.tone === "hall" || d.tone === "void");
  const spaces = geo.decor.filter((d) => d.tone === "room");

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
      <svg viewBox={`0 0 ${w} ${h}`} role="group" aria-label={`Схема: ${plan.title}, ${floor} этаж`} className="w-full min-w-80 rounded-2xl bg-m-ground md:max-h-[min(72dvh,42rem)]">
        <defs>
          <pattern id="busy-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2.5" height="7" className="fill-ink-3" opacity="0.25" />
          </pattern>
        </defs>

        {/* Дворы снаружи корпуса. */}
        {yards.map((d, i) => (
          <g key={`y${i}`} aria-hidden>
            <path d={rectPath(bbox(d.pts))} className="fill-m-yard" />
            {d.label && (
              <text x={d.c[0]} y={d.c[1] + 4} textAnchor="middle" fontSize={labelSize(d.pts, d.label)} className="fill-ink-2">
                {d.label}
              </text>
            )}
          </g>
        ))}

        {/* Корпус: сначала толстый контур всех частей, затем заливка поверх: внутренние стыки частей исчезают,
            снаружи остаётся наружная стена. */}
        {geo.wings.map((wg, i) => (
          <path key={`o${i}`} d={rectPath(bbox(wg.body))} strokeWidth={3.5} className="fill-m-floor stroke-m-wall" />
        ))}
        {geo.wings.map((wg, i) => (
          <path key={`f${i}`} d={rectPath(bbox(wg.body))} className="fill-m-floor" />
        ))}

        {/* Холлы и проёмы «второго света». */}
        {open.map((d, i) => (
          <g key={`h${i}`}>
            {d.tone === "void" ? (
              <path d={rectPath(bbox(d.pts))} strokeWidth={1} strokeDasharray="4 3" className="fill-m-ground stroke-m-wall" />
            ) : (
              <path d={rectPath(bbox(d.pts))} className="fill-m-floor" />
            )}
            {d.icon && <Badge icon={d.icon} at={[d.c[0], d.c[1] - (d.label ? 8 : 0)]} />}
            {d.label && (
              <text x={d.c[0]} y={d.c[1] + (d.icon ? 14 : 4)} textAnchor="middle" fontSize={labelSize(d.pts, d.label)} className="fill-ink-2">
                {d.label}
              </text>
            )}
          </g>
        ))}

        {/* Помещения без номера: лестницы, туалеты, столовая, гардероб, спортзал. */}
        {spaces.map((d, i) => {
          const b = bbox(d.pts);
          const tall = b.y1 - b.y0 >= 44 && b.x1 - b.x0 >= 40;
          return (
            <g key={`s${i}`}>
              <path d={rectPath(b)} className={spaceFill(d.icon)} />
              <path d={walls(d.pts, d.door)} strokeWidth={1} className="fill-none stroke-m-wall" />
              {d.icon && <Badge icon={d.icon} at={[d.c[0], d.c[1] - (d.label && tall ? 8 : 0)]} />}
              {d.label && tall && (
                <text x={d.c[0]} y={d.c[1] + 14} textAnchor="middle" fontSize={labelSize(d.pts, d.label)} className="fill-ink-2 text-m-floor" {...HALO}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}

        {geo.rooms.map(({ room, pts: p, c, narrow, door }) => {
          const s = ROOM_KIND_STYLE[room.kind];
          const isSel = room.number === selected;
          const isBusy = busy.has(room.id);
          const isMine = my.has(room.id);
          const label = [
            `Аудитория ${room.number}`,
            room.title ?? roomKindLabel[room.kind],
            `${room.capacity} мест`,
            room.bookable ? "можно забронировать" : null,
            isBusy ? "сейчас занята" : "сейчас свободна",
            isMine ? "есть ваша бронь" : null,
          ]
            .filter(Boolean)
            .join(", ");
          const b = bbox(p);
          const inset = { x0: b.x0 + 1.5, y0: b.y0 + 1.5, x1: b.x1 - 1.5, y1: b.y1 - 1.5 };
          const fs = narrow ? 11 : room.kind === "LECTURE_HALL" ? 14 : 13;
          return (
            <Link key={room.id} href={href(room.number)} aria-label={label} aria-current={isSel ? "true" : undefined} className="group outline-none">
              <path d={rectPath(b)} className={`transition-[fill] duration-200 group-hover:brightness-95 ${isSel ? "fill-brand-fill" : s.fill}`} />
              {isBusy && !isSel && <path d={rectPath(b)} fill="url(#busy-hatch)" />}
              <path d={walls(p, door)} strokeWidth={1} className="fill-none stroke-m-wall" />
              {isMine && !isSel && <path d={rectPath(inset)} strokeWidth={2.5} className="fill-none stroke-brand" />}
              {/* Кольцо фокуса с клавиатуры: тёмный контур, заметен и на выбранной аудитории. */}
              <path d={rectPath(inset)} strokeWidth={3} className="hidden fill-none stroke-ink group-focus-visible:inline" />
              <text
                x={c[0]}
                y={c[1] + (room.bookable ? 1 : 4.5)}
                textAnchor="middle"
                fontSize={fs}
                className={`font-medium ${isSel ? "fill-on-brand" : "fill-ink text-m-floor"}`}
                {...(isSel ? {} : HALO)}
              >
                {room.number}
              </text>
              {room.kind === "LECTURE_HALL" && !narrow && (
                <text x={c[0]} y={c[1] + 17} textAnchor="middle" fontSize={10} className={isSel ? "fill-on-brand" : "fill-ink-2 text-m-floor"} {...(isSel ? {} : HALO)}>
                  {room.capacity} мест
                </text>
              )}
              {room.bookable && <circle cx={c[0]} cy={c[1] + 9} r="2.6" className={isSel ? "fill-on-brand" : "fill-brand"} />}
            </Link>
          );
        })}

        {route && <RouteOverlay route={route} floor={floor} w={w} />}

        {/* Номера крыльев и лестницы в торцах коридоров. */}
        {plan.wingCount > 1 &&
          geo.wings.map(({ wing, badge }) =>
            badge ? (
              <g key={`n${wing}`} aria-hidden>
                <circle cx={badge[0]} cy={badge[1]} r="8" strokeWidth={1.2} className="fill-m-floor stroke-m-wall" />
                <text x={badge[0]} y={badge[1] + 3.5} textAnchor="middle" fontSize={10} className="fill-ink-2 font-semibold">
                  {wing}
                </text>
              </g>
            ) : null,
          )}
        {geo.marks.map((m, i) => (
          <Badge key={`m${i}`} icon={m.icon} at={m.at} size={14} />
        ))}
      </svg>
    </div>
  );
}

/**
 * Маршрут на схеме: пунктир по проходам (анимация «бегущих» штрихов только без prefers-reduced-motion), старт, финиш и
 * переходы по лестнице с подписью этажа. Декоративный слой: текстовая версия — шаги под схемой, клики проходят насквозь.
 */
function RouteOverlay({ route, floor, w }: { route: { legs: RouteLeg[] }; floor: number; w: number }) {
  const legs = route.legs.map((l, i) => ({ ...l, i })).filter((l) => l.floor === floor);
  const pill = (at: Pt, text: string, key: string) => {
    const width = text.length * 6.2 + 12;
    const x = Math.min(Math.max(at[0] + 10, 4), w - width - 4);
    return (
      <g key={key}>
        <rect x={x} y={at[1] - 20} width={width} height={16} rx={8} className="fill-brand-fill" />
        <text x={x + width / 2} y={at[1] - 8.5} textAnchor="middle" fontSize={10} className="fill-on-brand font-semibold">
          {text}
        </text>
      </g>
    );
  };
  return (
    <g aria-hidden pointerEvents="none">
      {legs.map(({ points, i }) =>
        points.length > 1 ? (
          <g key={`r${i}`}>
            <polyline points={points.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" className="fill-none stroke-brand-soft" />
            <polyline
              points={points.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}
              strokeWidth={3}
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="route-flow fill-none stroke-brand"
            />
          </g>
        ) : null,
      )}
      {legs.map(({ points, i }) => (
        <g key={`e${i}`}>
          {i === 0 && <circle cx={points[0][0]} cy={points[0][1]} r={5.5} strokeWidth={2} className="fill-brand stroke-m-floor" />}
          {i === route.legs.length - 1 && (
            <circle cx={points.at(-1)![0]} cy={points.at(-1)![1]} r={4} strokeWidth={2} className="fill-m-floor stroke-brand" />
          )}
        </g>
      ))}
      {legs.map(({ points, i }) => {
        // Пролёты подряд без остановки — одна подпись: откуда пришли и куда идём дальше.
        const pass = points.length <= 1 && i > 0 && i < route.legs.length - 1;
        const out = i < route.legs.length - 1 && !pass ? climbEnd(route.legs, i + 1) : null;
        const into = i > 0 ? climbStart(route.legs, i - 1) : null;
        return (
          <g key={`s${i}`}>
            {pass ? (
              <>
                <circle cx={points[0][0]} cy={points[0][1]} r={4} strokeWidth={2} className="fill-brand stroke-m-floor" />
                {pill(points[0], `дальше на ${climbEnd(route.legs, i + 1)} эт.`, "pass")}
              </>
            ) : (
              <>
                {into !== null && (
                  <>
                    <circle cx={points[0][0]} cy={points[0][1]} r={4} strokeWidth={2} className="fill-brand stroke-m-floor" />
                    {pill(points[0], `с ${into} эт.`, "in")}
                  </>
                )}
                {out !== null && (
                  <>
                    <circle cx={points.at(-1)![0]} cy={points.at(-1)![1]} r={4} strokeWidth={2} className="fill-brand stroke-m-floor" />
                    {pill(points.at(-1)!, `на ${out} эт.`, "out")}
                  </>
                )}
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Этаж, где закончится подъём или спуск, начатый на участке i (пролёты подряд без остановок). */
function climbEnd(legs: RouteLeg[], i: number) {
  while (legs[i + 1] && legs[i].points.length <= 1) i++;
  return legs[i].floor;
}
/** Этаж, где начался подъём или спуск, который закончился сразу после участка i. */
function climbStart(legs: RouteLeg[], i: number) {
  while (i > 0 && legs[i].points.length <= 1) i--;
  return legs[i].floor;
}

export function MapLegend() {
  const kinds: [RoomKind, string][] = [
    ["CLASSROOM", "Аудитория"],
    ["LECTURE_HALL", "Лекционная"],
    ["COWORKING", "Коворкинг"],
    ["MEETING", "Переговорная"],
  ];
  const icons: DecorIcon[] = ["stairs", "toilet", "coat", "food"];
  return (
    <ul aria-label="Обозначения" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {kinds.map(([k, text]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-3 rounded-sm ${ROOM_KIND_STYLE[k].soft}`} />
          {text}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-brand" />
        можно забронировать
      </li>
      <li className="flex items-center gap-1.5">
        <svg aria-hidden width="12" height="12" className="rounded-sm ring-1 ring-m-wall">
          <rect width="12" height="12" fill="url(#busy-hatch)" />
        </svg>
        занято сейчас
      </li>
      {icons.map((i) => {
        const I = ICON[i];
        return (
          <li key={i} className="flex items-center gap-1.5">
            <span aria-hidden className={`grid size-4 place-items-center rounded ${BADGE_BG[i]}`}>
              <I className="size-3 text-m-ic-glyph" strokeWidth={2.4} />
            </span>
            {ICON_LABEL[i]}
          </li>
        );
      })}
    </ul>
  );
}
