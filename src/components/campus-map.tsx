import { ArrowUpDown, BookOpen, DoorOpen, Dumbbell, type LucideIcon, Shirt, Toilet, Utensils } from "lucide-react";
import Link from "next/link";
import { roomKindLabel, type DecorIcon, type PlanBuilding, type Pt, type RoomKind } from "@/lib/campus/plans";

// Условная схема этажа: крылья разного оттенка, аудитории окрашены по типу, служебные помещения подписаны иконками.
// Каждая аудитория является ссылкой: открывает её расписание и бронь. Размеры шрифта в SVG заданы в единицах viewBox.

export const ROOM_KIND_STYLE: Record<RoomKind, { fill: string; stroke: string; text: string; dot: string; soft: string; ink: string }> = {
  LECTURE_HALL: { fill: "fill-k-lecture-soft", stroke: "stroke-k-lecture", text: "fill-k-lecture", dot: "bg-k-lecture", soft: "bg-k-lecture-soft", ink: "text-k-lecture" },
  CLASSROOM: { fill: "fill-k-practice-soft", stroke: "stroke-k-practice", text: "fill-k-practice", dot: "bg-k-practice", soft: "bg-k-practice-soft", ink: "text-k-practice" },
  COMPUTER_LAB: { fill: "fill-k-consult-soft", stroke: "stroke-k-consult", text: "fill-k-consult", dot: "bg-k-consult", soft: "bg-k-consult-soft", ink: "text-k-consult" },
  LAB: { fill: "fill-k-language-soft", stroke: "stroke-k-language", text: "fill-k-language", dot: "bg-k-language", soft: "bg-k-language-soft", ink: "text-k-language" },
  COWORKING: { fill: "fill-k-sport-soft", stroke: "stroke-k-sport", text: "fill-k-sport", dot: "bg-k-sport", soft: "bg-k-sport-soft", ink: "text-k-sport" },
  MEETING: { fill: "fill-warn-soft", stroke: "stroke-warn", text: "fill-warn", dot: "bg-warn", soft: "bg-warn-soft", ink: "text-warn" },
};

// Оттенок крыла: заливка и такой же контур (скругляет углы подложки).
const WING_TINT = ["fill-brand-soft stroke-brand-soft", "fill-info-soft stroke-info-soft", "fill-ok-soft stroke-ok-soft"];
const ICON: Record<DecorIcon, LucideIcon> = { toilet: Toilet, stairs: ArrowUpDown, food: Utensils, sport: Dumbbell, book: BookOpen, coat: Shirt, entrance: DoorOpen };
const ICON_LABEL: Record<DecorIcon, string> = { toilet: "Туалет", stairs: "Лестница", food: "Столовая", sport: "Спортзал", book: "Библиотека", coat: "Гардероб", entrance: "Вход" };
const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

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
  const { w, h } = plan.view;
  const tint = (wing: number) => WING_TINT[(wing - 1) % WING_TINT.length];

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
      <svg viewBox={`0 0 ${w} ${h}`} role="group" aria-label={`Схема: ${plan.title}, ${floor} этаж`} className="w-full min-w-80 rounded-2xl bg-surface ring-1 ring-hairline">
        <defs>
          <pattern id="busy-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="8" className="fill-ink-3" opacity="0.28" />
          </pattern>
        </defs>

        {/* Крылья: подложка своего оттенка и коридор. */}
        {geo.wings.map((wg, i) => (
          <polygon key={`b${i}`} points={pts(wg.body)} strokeLinejoin="round" strokeWidth="8" className={tint(wg.wing)} />
        ))}
        {geo.wings.map((wg, i) => (
          <polygon key={`c${i}`} points={pts(wg.corridor)} className="fill-fill" />
        ))}
        {plan.wingCount > 1 &&
          geo.wings.map((wg) => (
            <g key={`n${wg.wing}`} aria-hidden>
              <circle cx={wg.badge[0]} cy={wg.badge[1]} r="9" className="fill-surface stroke-hairline" />
              <text x={wg.badge[0]} y={wg.badge[1] + 4} textAnchor="middle" fontSize={11} className="fill-ink-2 font-bold">
                {wg.wing}
              </text>
            </g>
          ))}

        {/* Холлы и служебные помещения: не кликаются, подписаны словом и иконкой. */}
        {geo.decor.map((d, i) => (
          <g key={`d${i}`}>
            <polygon
              points={pts(d.pts)}
              strokeWidth="1.5"
              strokeLinejoin="round"
              className={d.tone === "hall" ? "fill-page stroke-hairline" : d.tone === "quiet" ? "fill-info-soft stroke-hairline" : "fill-warn-soft stroke-hairline"}
            />
            {d.icon && <Glyph icon={d.icon} at={[d.c[0], d.c[1] - (d.label ? 8 : 0)]} className="text-ink-2" />}
            {d.label && (
              <text x={d.c[0]} y={d.c[1] + (d.icon ? 12 : 4)} textAnchor="middle" fontSize={11} className="fill-ink-2 font-medium">
                {d.label}
              </text>
            )}
          </g>
        ))}
        {geo.marks.map((m, i) => (
          <g key={`m${i}`} aria-hidden>
            <circle cx={m.at[0]} cy={m.at[1]} r="8" className="fill-surface stroke-hairline" />
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
          return (
            <Link key={room.id} href={href(room.number)} aria-label={label} aria-current={isSel ? "true" : undefined} className="group outline-none">
              <polygon
                points={pts(p)}
                strokeLinejoin="round"
                strokeWidth={isMine || isSel ? 3 : 1.25}
                className={`transition-[fill,stroke-width] duration-200 group-hover:brightness-95 ${isSel ? "fill-brand-fill stroke-brand-fill" : `${s.fill} ${isMine ? "stroke-brand" : s.stroke}`}`}
              />
              {isBusy && !isSel && <polygon points={pts(p)} fill="url(#busy-hatch)" />}
              {/* Кольцо фокуса с клавиатуры: тёмный контур, заметен и на выбранной аудитории. */}
              <polygon points={pts(p)} strokeWidth="5" strokeLinejoin="round" className="hidden fill-none stroke-ink group-focus-visible:inline" />
              <text x={c[0]} y={c[1] + (room.bookable ? 2 : 5)} textAnchor="middle" fontSize={fs} className={`font-bold tabular-nums ${isSel ? "fill-on-brand" : s.text}`}>
                {room.number}
              </text>
              {room.kind === "LECTURE_HALL" && !narrow && (
                <text x={c[0]} y={c[1] + 19} textAnchor="middle" fontSize={11} className={isSel ? "fill-on-brand" : "fill-ink-2"}>
                  {room.capacity} мест
                </text>
              )}
              {room.bookable && <circle cx={c[0]} cy={c[1] + 11} r="3" className={isSel ? "fill-on-brand" : s.text} />}
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
          <span aria-hidden className={`size-2.5 rounded-sm ${ROOM_KIND_STYLE[k].dot}`} />
          {roomKindLabel[k]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-ink-2" />
        можно забронировать
      </li>
      <li className="flex items-center gap-1.5">
        <svg aria-hidden width="12" height="12" className="rounded-sm ring-1 ring-hairline">
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
