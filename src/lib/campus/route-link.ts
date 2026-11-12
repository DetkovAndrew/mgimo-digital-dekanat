import { planFor, roomNumberFrom } from "./plans";

/** Аудитория занятия на схеме корпуса или null (онлайн, корпус без схемы, номер не со схемы). */
export function lessonRoomOnPlan(l: { online: boolean; room: string | null; building: { id: string } | null }) {
  const number = roomNumberFrom(l.room);
  if (l.online || !l.building || !number || !planFor(l.building.id)?.rooms.some((r) => r.number === number)) return null;
  return { buildingId: l.building.id, number };
}

/** Ссылка «Как пройти внутри»: схема корпуса с маршрутом от входа или из аудитории прошлой пары (from). */
export const indoorRouteHref = (room: { buildingId: string; number: string }, day: string, from: string | null) =>
  `/rooms/${room.buildingId}?${new URLSearchParams({ room: room.number, d: day, from: from ?? "entrance" })}#plan`;
