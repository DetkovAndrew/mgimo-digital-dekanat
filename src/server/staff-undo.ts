// Откат изменений пары сотрудником деканата: «Вернуть как было» в карточке пары (src/server/dal/staff-schedule.ts)
// и `npm run db:undo-staff` (scripts/undo-staff.ts) — перед показом жюри, без seed: заявки, брони и сессии не трогаются.
// Без "server-only": модуль нужен и скрипту. Права проверяет вызывающий; здесь — только работа внутри транзакции.
import type { Prisma } from "@/generated/prisma/client";
import { formatTime } from "@/lib/format";

type Tx = Prisma.TransactionClient;

/**
 * Блокировки в одном порядке для всех изменений пары: группа → пара (→ аудитория у вызывающего).
 * Группа — чтобы две пары одной группы не встали параллельно на одно время в разные аудитории (ревью Codex 79).
 * facultyCode — граница сотрудника; скрипт передаёт null. Пары нет (или она чужая) → null.
 */
export async function lockLesson(tx: Tx, lessonId: string, facultyCode: string | null) {
  const group = await tx.$queryRaw<{ id: string }[]>`
    SELECT g."id" FROM "lesson" l
    JOIN "course_offering" o ON o."id" = l."offeringId"
    JOIN "study_group" g ON g."id" = o."groupId"
    WHERE l."id" = ${lessonId} AND (${facultyCode}::text IS NULL OR g."facultyCode" = ${facultyCode})
    FOR UPDATE OF g
  `;
  if (!group.length) return null;
  await tx.$queryRaw`SELECT 1 FROM "lesson" WHERE "id" = ${lessonId} FOR UPDATE`;
  return { groupId: group[0].id };
}

/** Состояние пары до первого изменения сотрудником; null — сотрудник её не менял. */
export const originalOf = (tx: Tx, lessonId: string) =>
  tx.lessonChange.findFirst({
    where: { lessonId, staffId: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { previousStatus: true, previousStartsAt: true, previousEndsAt: true, previousRoom: true, previousBuildingId: true, previousOnline: true },
  });
export type LessonOriginal = NonNullable<Awaited<ReturnType<typeof originalOf>>>;

/** Аудитория со схемы корпуса по корпусу и строке «ауд. 1206»; не со схемы — null (как в scripts/sync-rooms.ts). */
export async function roomIdOf(tx: Tx, buildingId: string | null, room: string | null) {
  const number = room?.match(/\d{3,4}/)?.[0];
  if (!buildingId || !number) return null;
  return (await tx.room.findUnique({ where: { buildingId_number: { buildingId, number } }, select: { id: true } }))?.id ?? null;
}

/**
 * Накладки на новое время пары: другая пара группы, другая пара в той же аудитории, бронь студента. Текст отказа или null.
 * Аудиторию со схемы вызывающий уже заблокировал (как бронь в bookRoom), поэтому бронь на это время не пройдёт параллельно.
 */
export async function conflictOf(
  tx: Tx,
  p: { lessonId: string; groupId: string; startsAt: Date; endsAt: Date; online: boolean; roomId: string | null; buildingId: string | null; room: string | null },
) {
  const overlap = { startsAt: { lt: p.endsAt }, endsAt: { gt: p.startsAt } };
  const [groupBusy, roomLesson, roomBooking] = await Promise.all([
    tx.lesson.findFirst({ where: { id: { not: p.lessonId }, offering: { groupId: p.groupId }, status: { not: "CANCELLED" }, ...overlap }, select: { startsAt: true, endsAt: true } }),
    p.online
      ? null
      : tx.lesson.findFirst({
          where: { id: { not: p.lessonId }, status: { not: "CANCELLED" }, ...overlap, ...(p.roomId ? { roomId: p.roomId } : { buildingId: p.buildingId, room: p.room }) },
          select: { startsAt: true, endsAt: true },
        }),
    p.roomId ? tx.roomBooking.findFirst({ where: { roomId: p.roomId, status: "CONFIRMED", ...overlap }, select: { startsAt: true, endsAt: true } }) : null,
  ]);
  if (groupBusy) return `У группы в это время другая пара: ${formatTime(groupBusy.startsAt)}–${formatTime(groupBusy.endsAt)}`;
  if (roomLesson) return `Аудитория занята другой парой: ${formatTime(roomLesson.startsAt)}–${formatTime(roomLesson.endsAt)}`;
  if (roomBooking) return `Аудитория забронирована студентом: ${formatTime(roomBooking.startsAt)}–${formatTime(roomBooking.endsAt)}. Выберите другую аудиторию или время.`;
  return null;
}

/**
 * Пара — как до первого изменения сотрудником; записи сотрудника в истории и его уведомления об этой паре удаляются,
 * изменения из демо-данных остаются. Вызывать под lockLesson. Исходное время уже занято (пара группы, аудитория, бронь) —
 * отказ с причиной, база не меняется.
 */
export async function revertLesson(
  tx: Tx,
  lesson: { id: string; groupId: string; online: boolean },
  original: LessonOriginal,
  { future = false } = {},
) {
  const online = original.previousOnline ?? lesson.online;
  const roomId = online ? null : await roomIdOf(tx, original.previousBuildingId, original.previousRoom);
  if (roomId) await tx.$queryRaw`SELECT 1 FROM "room" WHERE "id" = ${roomId} FOR UPDATE`;
  // Время — после последней блокировки: пока ждали аудиторию, исходное начало могло пройти (ревью Codex 80).
  if (future && original.previousStartsAt < new Date()) return { ok: false as const, message: "Исходное время пары уже прошло" };
  const conflict = await conflictOf(tx, {
    lessonId: lesson.id, groupId: lesson.groupId, startsAt: original.previousStartsAt, endsAt: original.previousEndsAt,
    online, roomId, buildingId: original.previousBuildingId, room: original.previousRoom,
  });
  if (conflict) return { ok: false as const, message: conflict };
  const updated = await tx.lesson.update({
    where: { id: lesson.id },
    data: {
      status: original.previousStatus,
      startsAt: original.previousStartsAt,
      endsAt: original.previousEndsAt,
      room: original.previousRoom,
      buildingId: original.previousBuildingId,
      roomId,
      online,
    },
    select: { startsAt: true, endsAt: true, room: true, online: true, building: { select: { title: true } } },
  });
  await tx.lessonChange.deleteMany({ where: { lessonId: lesson.id, staffId: { not: null } } });
  await tx.notification.deleteMany({ where: { lessonId: lesson.id, staffId: { not: null } } });
  return { ok: true as const, lesson: updated };
}
