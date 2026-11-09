import "server-only";
import { prisma } from "../db";
import { requireStudent } from "../session";

/** Опубликованные уведомления текущего пользователя (будущие по publishedAt не видны). */
export async function listMyNotifications(opts: { unreadOnly?: boolean; take?: number } = {}) {
  const { userId } = await requireStudent();
  const rows = await prisma.notificationRecipient.findMany({
    where: {
      userId,
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
    where: { userId, readAt: null, notification: { publishedAt: { lte: new Date() } } },
  });
}

/** Отметить прочитанным. Только своё: фильтр по userId в самом UPDATE. */
export async function markMyNotificationRead(notificationId: string) {
  const { userId } = await requireStudent();
  await prisma.notificationRecipient.updateMany({
    where: { notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllMyNotificationsRead() {
  const { userId } = await requireStudent();
  await prisma.notificationRecipient.updateMany({
    where: { userId, readAt: null, notification: { publishedAt: { lte: new Date() } } },
    data: { readAt: new Date() },
  });
}
