import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { requireStudent } from "../session";

/** Опубликованные уведомления текущего пользователя (будущие по publishedAt не видны). */
export async function listMyNotifications(opts: { unreadOnly?: boolean; take?: number } = {}) {
  const { userId } = await requireStudent();
  const rows = await prisma.notificationRecipient.findMany({
    where: {
      userId,
      hiddenAt: null,
      ...(opts.unreadOnly ? { readAt: null } : {}),
      notification: { publishedAt: { lte: new Date() } },
    },
    orderBy: { notification: { publishedAt: "desc" } },
    take: opts.take ?? 100,
    select: {
      readAt: true,
      notification: {
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          important: true,
          publishedAt: true,
          lessonId: true,
          requestId: true,
        },
      },
    },
  });
  return rows.map((r) => ({ ...r.notification, readAt: r.readAt }));
}

export type MyNotification = Awaited<ReturnType<typeof listMyNotifications>>[number];

export async function countMyUnread() {
  const { userId } = await requireStudent();
  return prisma.notificationRecipient.count({
    where: { userId, hiddenAt: null, readAt: null, notification: { publishedAt: { lte: new Date() } } },
  });
}

/** Отметить прочитанным. Только своё: фильтр по userId в самом UPDATE. */
export async function markMyNotificationRead(notificationId: string) {
  const { userId } = await requireStudent();
  await prisma.notificationRecipient.updateMany({
    where: { notificationId, userId, hiddenAt: null, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllMyNotificationsRead() {
  const { userId } = await requireStudent();
  await prisma.notificationRecipient.updateMany({
    where: { userId, hiddenAt: null, readAt: null, notification: { publishedAt: { lte: new Date() } } },
    data: { readAt: new Date() },
  });
}

// Удаление у себя: скрывается доставка текущего студента, общее уведомление остаётся у остальных получателей.
const Ids = z.array(z.string().regex(/^[a-z0-9]{20,40}$/)).min(1).max(100);
const Stamp = z.iso.datetime();

export type HideResult = { ok: true; ids: string[]; at: string } | { ok: false; error: string };

const OTHER = "Вы вошли под другим аккаунтом. Обновите страницу.";

/**
 * Скрыть свои уведомления. Возвращает фактически скрытые id и метку операции — по ней «Вернуть» (ревью Codex 90).
 * owner — чей список открыт: экран, оставшийся от другого аккаунта, ничего не меняет (ревью Codex 91).
 */
export async function hideMyNotifications(input: unknown, owner: unknown): Promise<HideResult> {
  const { userId } = await requireStudent();
  if (owner !== userId) return { ok: false, error: OTHER };
  const parsed = Ids.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Не удалось удалить: неверный список" };
  const at = new Date();
  const ids = [...new Set(parsed.data)];
  // Один UPDATE … RETURNING: какие строки изменил именно этот запрос (уже скрытые и чужие не попадают).
  const rows = await prisma.$queryRaw<{ notificationId: string }[]>`
    UPDATE notification_recipient SET "hiddenAt" = ${at}
    WHERE "userId" = ${userId} AND "hiddenAt" IS NULL AND "notificationId" = ANY(${ids}::text[])
    RETURNING "notificationId"`;
  return { ok: true, ids: rows.map((r) => r.notificationId), at: at.toISOString() };
}

/** Вернуть скрытое одной операцией: только свои доставки с той же меткой — более позднее удаление не отменяется. */
export async function restoreMyNotifications(input: unknown, owner: unknown): Promise<{ ok: boolean; count: number }> {
  const { userId } = await requireStudent();
  if (owner !== userId) return { ok: false, count: 0 };
  const parsed = z.object({ ids: Ids, at: Stamp }).safeParse(input);
  if (!parsed.success) return { ok: false, count: 0 };
  const { count } = await prisma.notificationRecipient.updateMany({
    where: { userId, notificationId: { in: parsed.data.ids }, hiddenAt: new Date(parsed.data.at) },
    data: { hiddenAt: null },
  });
  return { ok: true, count };
}
