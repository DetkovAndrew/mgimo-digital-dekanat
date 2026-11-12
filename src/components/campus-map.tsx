import Link from "next/link";
import { layoutFloor, roomKindLabel, type PlanBuilding, type RoomKind } from "@/lib/campus/plans";

// Условная схема этажа: крылья разного оттенка, аудитории окрашены по типу. Каждая аудитория является ссылкой:
// открывает её расписание и бронь ниже. Размеры шрифта в SVG заданы в единицах viewBox (атрибут fontSize). Классы записаны целиком: Tailwind собирает только то, что видит.

export const ROOM_KIND_STYLE: Record<RoomKind, { fill: string; stroke: string; text: string; dot: string; soft: string; ink: string }> = {
  LECTURE_HALL: { fill: "fill-k-lecture-soft", stroke: "stroke-k-lecture", text: "fill-k-lecture", dot: "bg-k-lecture", soft: "bg-k-lecture-soft", ink: "text-k-lecture" },
  CLASSROOM: { fill: "fill-k-practice-soft", stroke: "stroke-k-practice", text: "fill-k-practice", dot: "bg-k-practice", soft: "bg-k-practice-soft", ink: "text-k-practice" },
  COMPUTER_LAB: { fill: "fill-k-consult-soft", stroke: "stroke-k-consult", text: "fill-k-consult", dot: "bg-k-consult", soft: "bg-k-consult-soft", ink: "text-k-consult" },
  LAB: { fill: "fill-k-language-soft", stroke: "stroke-k-language", text: "fill-k-language", dot: "bg-k-language", soft: "bg-k-language-soft", ink: "text-k-language" },
  COWORKING: { fill: "fill-k-sport-soft", stroke: "stroke-k-sport", text: "fill-k-sport", dot: "bg-k-sport", soft: "bg-k-sport-soft", ink: "text-k-sport" },
  MEETING: { fill: "fill-warn-soft", stroke: "stroke-warn", text: "fill-warn", dot: "bg-warn", soft: "bg-warn-soft", ink: "text-warn" },
};

const WING_TINT = ["fill-brand-soft", "fill-info-soft", "fill-ok-soft"];
const box = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x, y: r.y, width: r.w, height: r.h });

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
  const { rooms, corridors } = layoutFloor(plan, floor);
  const busy = new Set(busyNow);
  const my = new Set(mine);
  const { w, h } = plan.view;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="group"
        aria-label={`Схема: ${plan.short}, ${floor} этаж`}
        className="w-full min-w-80 rounded-2xl bg-surface ring-1 ring-hairline"
      >
        <defs>
          <pattern id="busy-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="8" className="fill-ink-3" opacity="0.28" />
          </pattern>
        </defs>

        {plan.wings.map((wing, i) => (
          <g key={wing.wing}>
            <rect {...box(wing.rect)} rx="14" className={WING_TINT[i % WING_TINT.length]} />
            <text
              x={wing.dir === "h" ? wing.rect.x + 8 : wing.rect.x + wing.rect.w / 2}
              y={wing.dir === "h" ? wing.rect.y - 6 : wing.rect.y - 6}
              textAnchor={wing.dir === "h" ? "start" : "middle"}
              fontSize={11} className="fill-ink-2 font-semibold"
            >
              Крыло {wing.wing}
            </text>
          </g>
        ))}
        {corridors.map((c, i) => (
          <rect key={i} {...box(c)} className="fill-fill" />
        ))}
        {plan.hall && (
          <g>
            <rect {...box(plan.hall)} rx="14" className="fill-page stroke-hairline" strokeWidth="1.5" />
            <text x={plan.hall.x + plan.hall.w / 2} y={plan.hall.y + plan.hall.h / 2 + 4} textAnchor="middle" fontSize={12} className="fill-ink-2 font-medium">
              {plan.hall.label}
            </text>
            {plan.hall.h > 60 && (
              <text x={plan.hall.x + plan.hall.w / 2} y={plan.hall.y + plan.hall.h - 12} textAnchor="middle" fontSize={10} className="fill-ink-3">
                вход
              </text>
            )}
          </g>
        )}

        {rooms.map(({ room, rect }) => {
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
          return (
            <Link key={room.id} href={href(room.number)} aria-label={label} aria-current={isSel ? "true" : undefined} className="group outline-none">
              <rect
                {...box(rect)}
                rx="6"
                strokeWidth={isMine || isSel ? 3 : 1.25}
                className={`transition-[fill,stroke-width] duration-200 group-hover:brightness-95 ${isSel ? "fill-brand-fill stroke-brand-fill" : `${s.fill} ${isMine ? "stroke-brand" : s.stroke}`}`}
              />
              {isBusy && !isSel && <rect {...box(rect)} rx="6" fill="url(#busy-hatch)" />}
              {/* Кольцо фокуса с клавиатуры: тёмный контур снаружи, заметен и на выбранной (залитой) аудитории. */}
              <rect
                x={rect.x - 3}
                y={rect.y - 3}
                width={rect.w + 6}
                height={rect.h + 6}
                rx="8"
                strokeWidth="2.5"
                className="hidden fill-none stroke-ink group-focus-visible:inline"
              />
              <text
                x={rect.x + rect.w / 2}
                y={rect.y + rect.h / 2 + (room.bookable ? -1 : 4)}
                textAnchor="middle"
                fontSize={12}
                className={`font-bold tabular-nums ${isSel ? "fill-on-brand" : s.text}`}
              >
                {room.number}
              </text>
              {room.bookable && (
                <circle cx={rect.x + rect.w / 2} cy={rect.y + rect.h / 2 + 9} r="2.6" className={isSel ? "fill-on-brand" : s.text} />
              )}
            </Link>
          );
        })}
      </svg>
    </div>
  );
}

export function MapLegend() {
  const kinds: RoomKind[] = ["LECTURE_HALL", "CLASSROOM", "COMPUTER_LAB", "LAB", "COWORKING", "MEETING"];
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
    </ul>
  );
}
