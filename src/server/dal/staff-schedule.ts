import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { planFor } from "@/lib/campus/plans";
import { addDays, formatDay, formatTime, mskStartOfDay } from "@/lib/format";
import { lessonVersion, mskAt, MOVE_WINDOW_DAYS, rescheduleSchema, type ScheduleActionState } from "@/lib/staff/schedule";
import { prisma } from "../db";
import { requireStaff } from "../session";
import { conflictOf, lockLesson, originalOf, revertLesson } from "../staff-undo";

// Перенос и отмена пары сотрудником деканата. Граница — факультет сотрудника (как у заявок, src/server/dal/staff.ts):
// только пары групп своего факультета. Одна транзакция: пара, запись в истории (LessonChange) и уведомление всей
// группе — студент видит «Изменено», что поменялось, уведомление и новый путь до аудитории.
// Демо-аккаунт сотрудника общий для жюри, поэтому любое изменение можно вернуть: «Вернуть как было» — по первой записи
// сотрудника в истории пары (src/server/staff-undo.ts).

const facultyScope = (facultyCode: string) => ({ offering: { group: { facultyCode } } }) satisfies Prisma.LessonWhereInput;

const lessonSelect = {
  id: true, kind: true, startsAt: true, endsAt: true, status: true, room: true, online: true,
  building: { select: { id: true, title: true } },
  offering: { select: { discipline: { select: { title: true, shortTitle: true } }, group: { select: { id: true, code: true, course: true } } } },
} satisfies Prisma.LessonSelect;

/**
 * Пары факультета на ближайшие дни (можно одной группы), ещё не закончившиеся, — список для выбора.
 * changed — пары, которые менял деканат, на любую дату (перенос — до 60 дней вперёд): их можно вернуть как было.
 */
export async function listFacultyLessons(opts: { days?: number; group?: string } = {}) {
  const { facultyCode } = await requireStaff();
  const now = new Date();
  const from = mskStartOfDay(now);
  const scope = { ...facultyScope(facultyCode), ...(opts.group ? { offering: { group: { facultyCode, code: opts.group } } } : {}) } satisfies Prisma.LessonWhereInput;
  const [groups, lessons, changed] = await Promise.all([
    prisma.studyGroup.findMany({ where: { facultyCode }, orderBy: [{ course: "asc" }, { code: "asc" }], select: { id: true, code: true } }),
    prisma.lesson.findMany({
      where: { ...scope, endsAt: { gt: now }, startsAt: { lt: addDays(from, opts.days ?? 14) } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: lessonSelect,
    }),
    prisma.lesson.findMany({
      where: { ...scope, endsAt: { gt: now }, changes: { some: { staffId: { not: null } } } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: lessonSelect,
    }),
  ]);
  return { groups, lessons, changed };
}

export async function getFacultyLesson(id: string) {
  const { facultyCode } = await requireStaff();
  const lesson = await prisma.lesson.findFirst({
    where: { id, ...facultyScope(facultyCode) },
    select: { ...lessonSelect, changes: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, newStatus: true, reason: true, createdAt: true, staffId: true } } },
  });
  if (!lesson) notFound();
  const [buildings, original] = await Promise.all([
    prisma.building.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    originalOf(prisma, lesson.id),
  ]);
  const originalBuilding = original?.previousBuildingId ? (buildings.find((b) => b.id === original.previousBuildingId) ?? null) : null;
  return { lesson, version: lessonVersion(lesson), buildings, original: original && { ...original, building: originalBuilding } };
}

const place = (room: string | null, building: { title: string } | null, online: boolean) =>
  online ? "онлайн" : [room, building?.title].filter(Boolean).join(", ") || "место не указано";

export async function rescheduleFacultyLesson(input: unknown): Promise<ScheduleActionState> {
  const { facultyCode, staffId } = await requireStaff();
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте данные" };
  const v = parsed.data;

  // Корпус не выбран — место не меняется. Выбран — нужен и номер; номер — только со схемы корпуса, если схема есть.
  // Аудиторию ищем до транзакции: это справочник.
  let target: { buildingId: string; room: string | null; roomId: string | null; title: string } | null = null;
  if (v.action === "move" && v.building) {
    const building = await prisma.building.findUnique({ where: { id: v.building }, select: { id: true, title: true } });
    if (!building) return { ok: false, message: "Такого корпуса нет" };
    if (!v.room) return { ok: false, message: "Укажите номер аудитории в выбранном корпусе" };
    const plan = planFor(building.id);
    if (plan && !plan.rooms.some((r) => r.number === v.room)) return { ok: false, message: `В корпусе «${building.title}» нет аудитории ${v.room}` };
    const ref = await prisma.room.findUnique({ where: { buildingId_number: { buildingId: building.id, number: v.room } }, select: { id: true } });
    target = { buildingId: building.id, room: `ауд. ${v.room}`, roomId: ref?.id ?? null, title: building.title };
  }

  return prisma.$transaction(async (tx) => {
    // Блокируем группу и пару своего факультета (чужая → 404). Значения — параметрами tagged SQL.
    if (!(await lockLesson(tx, v.id, facultyCode))) notFound();
    // Время — после ожидания блокировок: пока ждали, пара могла начаться (ревью Codex 79).
    const now = new Date();
    const lesson = await tx.lesson.findFirstOrThrow({
      where: { id: v.id, ...facultyScope(facultyCode) },
      select: { ...lessonSelect, buildingId: true, roomId: true, offering: { select: { groupId: true, discipline: { select: { title: true, shortTitle: true } } } } },
    });
    if (lessonVersion(lesson) !== v.expected) return { ok: false, message: "Пару уже изменили. Обновите страницу и проверьте историю." };
    if (lesson.endsAt <= now) return { ok: false, message: "Пара уже прошла — её не изменить" };

    const title = lesson.offering.discipline.shortTitle ?? lesson.offering.discipline.title;
    const students = () => tx.studentProfile.findMany({ where: { groupId: lesson.offering.groupId }, select: { userId: true } });

    if (v.action === "restore") {
      const original = await originalOf(tx, lesson.id);
      if (!original) return { ok: false, message: "Деканат эту пару не менял — возвращать нечего" };
      if (original.previousStartsAt < now) return { ok: false, message: "Исходное время пары уже прошло — вернуть нельзя" };
      const res = await revertLesson(tx, { id: lesson.id, groupId: lesson.offering.groupId, online: lesson.online }, original, { future: true });
      if (!res.ok) return { ok: false, message: `Вернуть нельзя: ${res.message.charAt(0).toLowerCase()}${res.message.slice(1)}` };
      const r = res.lesson;
      const group = await students();
      await tx.notification.create({
        data: {
          kind: "SCHEDULE_CHANGE",
          title: `Снова по расписанию: ${title}`,
          body: `«${title}» — как раньше: ${formatDay(r.startsAt)}, ${formatTime(r.startsAt)}–${formatTime(r.endsAt)}, ${place(r.room, r.building, r.online)}. Прежнее изменение деканат отменил.`,
          important: true,
          lessonId: lesson.id,
          staffId,
          recipients: { create: group.map((s) => ({ userId: s.userId })) },
        },
      });
      return { ok: true, message: `Пара снова по исходному расписанию. Уведомление получили студенты группы: ${group.length}.` };
    }
    if (lesson.status === "CANCELLED") return { ok: false, message: "Пара уже отменена" };

    const was = `${formatDay(lesson.startsAt)}, ${formatTime(lesson.startsAt)}`;
    let data: Prisma.LessonUncheckedUpdateInput;
    let body: string;

    if (v.action === "cancel") {
      data = { status: "CANCELLED" };
      body = `«${title}» ${was} отменено.`;
    } else {
      const startsAt = mskAt(v.date, v.start);
      const endsAt = mskAt(v.date, v.end);
      if (startsAt < now) return { ok: false, message: "Новое время уже прошло" };
      if (startsAt > addDays(now, MOVE_WINDOW_DAYS)) return { ok: false, message: `Перенос — не дальше чем на ${MOVE_WINDOW_DAYS} дней вперёд` };
      const next = target ?? { buildingId: lesson.buildingId, room: lesson.room, roomId: lesson.roomId, title: lesson.building?.title ?? "" };
      const sameTime = startsAt.getTime() === lesson.startsAt.getTime() && endsAt.getTime() === lesson.endsAt.getTime();
      if (sameTime && next.buildingId === lesson.buildingId && next.room === lesson.room) return { ok: false, message: "Ничего не изменилось: укажите новое время или аудиторию" };

      // Аудиторию блокируем так же, как бронь (bookRoom): перенос и бронь на одно время не пройдут одновременно.
      if (next.roomId) await tx.$queryRaw`SELECT 1 FROM "room" WHERE "id" = ${next.roomId} FOR UPDATE`;
      const conflict = await conflictOf(tx, {
        lessonId: lesson.id, groupId: lesson.offering.groupId, startsAt, endsAt,
        online: lesson.online && !target, roomId: next.roomId, buildingId: next.buildingId, room: next.room,
      });
      if (conflict) return { ok: false, message: conflict };
      // Повторно после блокировки аудитории: ожидание могло сделать время прошедшим (ревью Codex 80).
      const after = new Date();
      if (startsAt < after || lesson.endsAt <= after) return { ok: false, message: "Время уже прошло. Обновите страницу." };

      data = { status: "RESCHEDULED", startsAt, endsAt, ...(target ? { buildingId: target.buildingId, room: target.room, roomId: target.roomId, online: false } : {}) };
      const where = place(target ? target.room : lesson.room, target ? { title: target.title } : lesson.building, target ? false : lesson.online);
      body = `«${title}» ${was} перенесено на ${formatDay(startsAt)}, ${formatTime(startsAt)}–${formatTime(endsAt)}, ${where}.`;
    }

    const updated = await tx.lesson.update({ where: { id: lesson.id }, data, select: { status: true, startsAt: true, endsAt: true, room: true, buildingId: true } });
    await tx.lessonChange.create({
      data: {
        lessonId: lesson.id,
        previousStatus: lesson.status,
        newStatus: updated.status,
        previousStartsAt: lesson.startsAt,
        previousEndsAt: lesson.endsAt,
        previousRoom: lesson.room,
        previousBuildingId: lesson.buildingId,
        previousOnline: lesson.online,
        newStartsAt: updated.startsAt,
        newEndsAt: updated.endsAt,
        newRoom: updated.room,
        newBuildingId: updated.buildingId,
        reason: v.reason,
        staffId,
        createdAt: now,
      },
    });
    const group = await students();
    await tx.notification.create({
      data: {
        kind: "SCHEDULE_CHANGE",
        title: v.action === "cancel" ? `Отмена: ${title}` : `Изменение: ${title}`,
        body: `${body} Причина: ${v.reason}`,
        important: true,
        lessonId: lesson.id,
        staffId,
        recipients: { create: group.map((s) => ({ userId: s.userId })) },
      },
    });
    const n = group.length;
    return { ok: true, message: `${v.action === "cancel" ? "Пара отменена" : "Пара перенесена"}. Уведомление получили студенты группы: ${n}.` };
  });
}
