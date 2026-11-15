// Поиск аудиторий для «Карты»: по номеру, названию, типу и корпусу. Индекс строит сервер из схем (plans.ts),
// в браузер уходит только плоский список — без геометрии этажей.

export type RoomIndexItem = {
  buildingId: string;
  short: string; // «ГК»
  building: string; // «Главный корпус»
  number: string;
  floor: number;
  kind: string; // «Переговорная»
  title: string | null;
  bookable: boolean;
};

const norm = (s: string) => s.toLowerCase().replaceAll("ё", "е");

/**
 * Каждое слово запроса должно найтись. Слово из цифр — начало номера («11» → 1101, 1117), остальные — подстрока
 * названия, типа или корпуса («атриум», «перег», «гк»). Номер, совпавший целиком, — первым.
 */
export function searchRooms(index: readonly RoomIndexItem[], query: string, limit = 30): RoomIndexItem[] {
  const words = norm(query).split(/[\s,.·]+/).filter(Boolean);
  if (!words.length) return [];
  const found = index.filter((r) => {
    const text = norm(`${r.title ?? ""} ${r.kind} ${r.short} ${r.building}`);
    return words.every((w) => (/^\d+$/.test(w) ? r.number.startsWith(w) : text.includes(w)));
  });
  const exact = (r: RoomIndexItem) => (words.includes(r.number) ? 0 : 1);
  return found.sort((a, b) => exact(a) - exact(b) || a.number.localeCompare(b.number) || a.short.localeCompare(b.short)).slice(0, limit);
}

/** Схема корпуса с выбранной аудиторией: этаж, её расписание, бронь и «Как пройти». */
export const roomOnMapHref = (r: { buildingId: string; number: string }) => `/rooms/${r.buildingId}?room=${encodeURIComponent(r.number)}#room`;
