// Маршруты между корпусами без внешних API: расстояние по прямой с поправкой на улицы.
// Это ОЦЕНКА — в интерфейсе подписывается «≈» и ведёт на точный маршрут в Яндекс Картах.

export type Point = { lat: number; lon: number };

const EARTH_RADIUS_M = 6_371_000;
const STREET_FACTOR = 1.35; // улицы длиннее прямой линии
const WALK_M_PER_MIN = 75; // ≈ 4.5 км/ч
const TRANSIT_M_PER_MIN = 300; // ≈ 18 км/ч в среднем по городу с пересадками
const TRANSIT_OVERHEAD_MIN = 10; // дойти до остановки/метро и подождать
const MIN_TRANSFER_MIN = 3; // даже соседняя литера: выйти, дойти, подняться на этаж

export function distanceMeters(a: Point, b: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export type TravelEstimate = { walkMin: number; transitMin: number; meters: number };

export function estimateTravel(a: Point, b: Point): TravelEstimate {
  const meters = distanceMeters(a, b) * STREET_FACTOR;
  return {
    meters: Math.round(meters),
    walkMin: Math.max(MIN_TRANSFER_MIN, Math.ceil(meters / WALK_M_PER_MIN)),
    transitMin: Math.ceil(TRANSIT_OVERHEAD_MIN + meters / TRANSIT_M_PER_MIN),
  };
}

export type TransferVerdict =
  | { kind: "same-building"; gapMin: number }
  | { kind: "ok"; estimate: TravelEstimate; gapMin: number; mode: "walk" | "transit" }
  | { kind: "tight"; estimate: TravelEstimate; gapMin: number } // только транспортом, и можно не успеть
  | { kind: "impossible"; estimate: TravelEstimate; gapMin: number };

/** Успеет ли студент перейти между корпусами за перерыв между парами. */
export function judgeTransfer(from: Point & { id: string }, to: Point & { id: string }, gapMin: number): TransferVerdict {
  if (from.id === to.id) return { kind: "same-building", gapMin };
  const estimate = estimateTravel(from, to);
  if (estimate.walkMin <= gapMin) return { kind: "ok", estimate, gapMin, mode: "walk" };
  if (estimate.transitMin <= gapMin) {
    // Запас меньше 5 минут — предупреждаем.
    return gapMin - estimate.transitMin < 5
      ? { kind: "tight", estimate, gapMin }
      : { kind: "ok", estimate, gapMin, mode: "transit" };
  }
  return { kind: "impossible", estimate, gapMin };
}

// ─── Яндекс Карты: ссылки работают без API-ключа ─────────────────────────────

/** Точка корпуса на карте. */
export function yandexPointUrl(p: Point): string {
  return `https://yandex.ru/maps/?pt=${p.lon},${p.lat}&z=17&l=map`;
}

/** Маршрут до корпуса от текущего местоположения (пустая начальная точка). */
export function yandexRouteUrl(to: Point, mode: "pd" | "mt" = "mt", from?: Point): string {
  const start = from ? `${from.lat},${from.lon}` : "";
  return `https://yandex.ru/maps/?rtext=${start}~${to.lat},${to.lon}&rtt=${mode}`;
}
