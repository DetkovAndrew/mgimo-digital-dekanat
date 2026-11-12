import { ArrowUpDown, BookOpen, DoorOpen, Dumbbell, type LucideIcon, Shirt, Toilet, Trees, Utensils } from "lucide-react";
import Link from "next/link";
import { roomKindLabel, type DecorIcon, type PlanBuilding, type Pt, type RoomKind } from "@/lib/campus/plans";

// Условная схема этажа: пастельные крылья, скруглённые помещения, цвет аудитории — её тип, номер всегда text-ink.
// Каждая аудитория является ссылкой: открывает её расписание и бронь. Размеры шрифта в SVG заданы в единицах viewBox.

export const ROOM_KIND_STYLE: Record<RoomKind, { fill: string; soft: string }> = {
  LECTURE_HALL: { fill: "fill-m-hall", soft: "bg-m-hall" },
  CLASSROOM: { fill: "fill-m-class", soft: "bg-m-class" },
  COMPUTER_LAB: { fill: "fill-m-pc", soft: "bg-m-pc" },
  LAB: { fill: "fill-m-lab", soft: "bg-m-lab" },
  COWORKING: { fill: "fill-m-cowork", soft: "bg-m-cowork" },
  MEETING: { fill: "fill-m-meet", soft: "bg-m-meet" },
};

const WING_TINT = ["fill-m-wing-1", "fill-m-wing-2", "fill-m-wing-3"];
const DECOR_TONE = { hall: "fill-surface", void: "fill-page stroke-ink-3", service: "fill-m-service", quiet: "fill-m-quiet" } as const;
const ICON: Record<DecorIcon, LucideIcon> = { toilet: Toilet, stairs: ArrowUpDown, food: Utensils, sport: Dumbbell, book: BookOpen, coat: Shirt, entrance: DoorOpen, tree: Trees };
const ICON_LABEL: Record<DecorIcon, string> = { toilet: "Туалет", stairs: "Лестница", food: "Столовая", sport: "Спортзал", book: "Библиотека", coat: "Гардероб", entrance: "Вход", tree: "Двор" };

/** Подпись помещения 11 единиц, в узком (спортзал вдоль коридора) — мельче, чтобы не вылезала за стены. */
function labelSize(p: Pt[], label: string) {
  const width = Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
  return Math.min(11, (width - 6) / (label.length * 0.58));
}

/** Многоугольник со скруглёнными углами: радиус не больше половины соседних сторон. */
function rounded(p: Pt[], r: number) {
  const f = (n: number) => n.toFixed(1);
  const n = p.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const [prev, cur, next] = [p[(i + n - 1) % n], p[i], p[(i + 1) % n]];
    const toward = (q: Pt) => {
      const len = Math.hypot(q[0] - cur[0], q[1] - cur[1]);
      const k = Math.min(r, len / 2) / len;
      return [cur[0] + (q[0] - cur[0]) * k, cur[1] + (q[1] - cur[1]) * k];
    };
    const [a, b] = [toward(prev), toward(next)];
    d += `${i ? "L" : "M"}${f(a[0])},${f(a[1])} Q${f(cur[0])},${f(cur[1])} ${f(b[0])},${f(b[1])} `;
  }
  return `${d}Z`;
}

function Glyph({ icon, at, size = 14, className }: { icon: DecorIcon; at: Pt; size?: number; className: string }) {
  const I = ICON[icon];
  return <I x={at[0] - size / 2} y={at[1] - size / 2} width={size} height={size} strokeWidth={2} className={className} aria-hidden />;
}

export function CampusMap({
  plan,
  floor,
  busyNow,
  mine,
  selected,
  href,
}: {
  plan: PlanBuilding;
  floor: number;
  busyNow: string[];
  mine: string[];
  selected: string | null;
  href: (number: string) => string;
}) {
  const geo = plan.floor(floor);
  const busy = new Set(busyNow);
  const my = new Set(mine);
  const { w } = plan.view;
  const h = geo.h ?? plan.view.h;
  const tint = (wing: number) => WING_TINT[(wing - 1) % WING_TINT.length];

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
      <svg viewBox={`0 0 ${w} ${h}`} role="group" aria-label={`Схема: ${plan.title}, ${floor} этаж`} className="w-full min-w-80 rounded-2xl bg-page md:max-h-[min(72dvh,42rem)]">
        <defs>
          <pattern id="busy-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="8" className="fill-ink-3" opacity="0.22" />
          </pattern>
        </defs>

        {/* Крылья: подложка своего оттенка и светлый коридор. */}
        {geo.wings.map((wg, i) => (
          <path key={`b${i}`} d={rounded(wg.body, 22)} className={tint(wg.wing)} />
        ))}
        {geo.wings.map((wg, i) => wg.corridor && <path key={`c${i}`} d={rounded(wg.corridor, 8)} className="fill-surface" />)}
        {plan.wingCount > 1 &&
          geo.wings.map(({ wing, badge }) =>
            badge ? (
              <g key={`n${wing}`} aria-hidden>
                <circle cx={badge[0]} cy={badge[1]} r="9" className="fill-surface stroke-hairline" />
                <text x={badge[0]} y={badge[1] + 4} textAnchor="middle" fontSize={11} className="fill-ink-2 font-bold">
                  {wing}
                </text>
              </g>
            ) : null,
          )}

        {/* Холлы и служебные помещения: не кликаются, подписаны словом и иконкой. */}
        {geo.decor.map((d, i) => (
          <g key={`d${i}`}>
            <path d={rounded(d.pts, 16)} className={DECOR_TONE[d.tone]} {...(d.tone === "void" ? { strokeWidth: 1, strokeDasharray: "4 4" } : {})} />
            {d.icon && <Glyph icon={d.icon} at={[d.c[0], d.c[1] - (d.label ? 8 : 0)]} className="text-ink-2" />}
            {d.label && (
              <text x={d.c[0]} y={d.c[1] + (d.icon ? 12 : 4)} textAnchor="middle" fontSize={labelSize(d.pts, d.label)} className="fill-ink-2 font-medium">
                {d.label}
              </text>
            )}
          </g>
        ))}
        {geo.marks.map((m, i) => (
          <g key={`m${i}`} aria-hidden>
            <circle cx={m.at[0]} cy={m.at[1]} r="9" className="fill-surface stroke-hairline" />
            <Glyph icon={m.icon} at={m.at} size={10} className="text-ink-2" />
          </g>
        ))}

        {geo.rooms.map(({ room, pts: p, c, narrow }) => {
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
          // Крупно в единицах схемы: на телефоне шириной 360 px схема ужата почти вдвое.
          const fs = narrow ? 12 : room.kind === "LECTURE_HALL" ? 16 : 14;
          const shape = rounded(p, narrow ? 7 : 10);
          return (
            <Link key={room.id} href={href(room.number)} aria-label={label} aria-current={isSel ? "true" : undefined} className="group outline-none">
              <path
                d={shape}
                strokeWidth={isMine || isSel ? 3 : 0}
                className={`transition-[fill,stroke-width] duration-200 group-hover:brightness-95 ${isSel ? "fill-brand-fill stroke-brand-fill" : `${s.fill} stroke-brand`}`}
              />
              {isBusy && !isSel && <path d={shape} fill="url(#busy-hatch)" />}
              {/* Кольцо фокуса с клавиатуры: тёмный контур, заметен и на выбранной аудитории. */}
              <path d={shape} strokeWidth="4" className="hidden fill-none stroke-ink group-focus-visible:inline" />
              <text x={c[0]} y={c[1] + (room.bookable ? 2 : 5)} textAnchor="middle" fontSize={fs} className={`font-semibold tabular-nums ${isSel ? "fill-on-brand" : "fill-ink"}`}>
                {room.number}
              </text>
              {room.kind === "LECTURE_HALL" && !narrow && (
                <text x={c[0]} y={c[1] + 19} textAnchor="middle" fontSize={11} className={isSel ? "fill-on-brand" : "fill-ink"}>
                  {room.capacity} мест
                </text>
              )}
              {room.bookable && <circle cx={c[0]} cy={c[1] + 11} r="3" className={isSel ? "fill-on-brand" : "fill-ink-2"} />}
            </Link>
          );
        })}
      </svg>
    </div>
  );
}

export function MapLegend() {
  const kinds: RoomKind[] = ["LECTURE_HALL", "CLASSROOM", "COMPUTER_LAB", "LAB", "COWORKING", "MEETING"];
  const icons: DecorIcon[] = ["stairs", "toilet", "coat", "food"];
  return (
    <ul aria-label="Обозначения" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-3 rounded ${ROOM_KIND_STYLE[k].soft}`} />
          {roomKindLabel[k]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-ink-2" />
        можно забронировать
      </li>
      <li className="flex items-center gap-1.5">
        <svg aria-hidden width="12" height="12" className="rounded ring-1 ring-hairline">
          <rect width="12" height="12" fill="url(#busy-hatch)" />
        </svg>
        занято сейчас
      </li>
      {icons.map((i) => {
        const I = ICON[i];
        return (
          <li key={i} className="flex items-center gap-1.5">
            <I aria-hidden className="size-3.5" />
            {ICON_LABEL[i]}
          </li>
        );
      })}
    </ul>
  );
}
