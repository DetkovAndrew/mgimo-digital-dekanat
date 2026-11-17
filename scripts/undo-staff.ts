// Откат всего, что сделал кабинет сотрудника в общем расписании: переносы и отмены пар, объявления и уведомления
// деканата. Заявки, их статусы, справки, брони, физкультура и сессии не трогаются — в отличие от seed.
// Перед показом жюри и между проверками: `npm run db:undo-staff` (`-- --dry-run` — только посчитать).
// На сервере: `docker compose run --rm tools npm run db:undo-staff`.
import type { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/server/db";
import { lockLesson, originalOf, revertLesson } from "../src/server/staff-undo";

export async function undoStaffChanges({ dryRun = false } = {}) {
  const startedAt = new Date();
  const lessons = await prisma.lessonChange.findMany({ where: { staffId: { not: null } }, distinct: ["lessonId"], select: { lessonId: true } });
  const restored: string[] = [];
  const skipped: { lessonId: string; reason: string }[] = [];
  for (const { lessonId } of lessons) {
    if (dryRun) {
      restored.push(lessonId);
      continue;
    }
    const res = await prisma.$transaction(async (tx) => {
      const locked = await lockLesson(tx, lessonId, null);
      const original = locked && (await originalOf(tx, lessonId));
      if (!locked || !original) return { ok: true as const };
      const lesson = await tx.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { online: true } });
      // Прошедшее исходное время тоже возвращаем: история недели должна совпасть с демо-данными.
      return revertLesson(tx, { id: lessonId, groupId: locked.groupId, online: lesson.online }, original);
    });
    if (res.ok) restored.push(lessonId);
    else skipped.push({ lessonId, reason: res.message });
  }
  // Объявления и оставшиеся уведомления деканата, отправленные до запуска. Уведомления пар, у которых ещё есть изменение
  // сотрудника (не удалось вернуть или изменили, пока шёл откат), остаются вместе с изменением (ревью Codex 80).
  const where = {
    staffId: { not: null },
    publishedAt: { lte: startedAt },
    OR: [{ lessonId: null }, { lesson: { changes: { none: { staffId: { not: null } } } } }],
  } satisfies Prisma.NotificationWhereInput;
  const notifications = dryRun ? await prisma.notification.count({ where }) : (await prisma.notification.deleteMany({ where })).count;
  return { restored: restored.length, skipped, notifications };
}

if (process.argv[1]?.endsWith("undo-staff.ts")) {
  const dryRun = process.argv.includes("--dry-run");
  undoStaffChanges({ dryRun })
    .then((r) => {
      console.log(`${dryRun ? "Будет возвращено" : "Возвращено"} пар: ${r.restored}; ${dryRun ? "будет удалено" : "удалено"} объявлений и уведомлений деканата: ${r.notifications}.`);
      for (const s of r.skipped) console.log(`Не возвращена пара ${s.lessonId}: ${s.reason}`);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
