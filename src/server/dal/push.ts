import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { notificationLink } from "@/lib/notification-link";
import { prisma } from "../db";
import { isAuthSecret, isPushEndpoint, isUaPublicKey, sendPush, vapidPublicKey } from "../push/webpush";
import { requireStudentSession } from "../session";

// Уведомления на телефон (docs/plans/push.md, ревью Codex 98). Подписка — браузер этого устройства в текущей сессии
// студента: владелец и сессия только из cookies, из запроса — адрес службы и ключи браузера. owner — userId, для которого
// открыт экран: если в другой вкладке уже вошли другим аккаунтом, действие не выполняется (как у удаления уведомлений).

export const PUSH_LIMIT = { perUser: 20, testEveryMs: 30_000 };

export type PushResult = { ok: boolean; message: string };

const STALE: PushResult = { ok: false, message: "Аккаунт сменился — обновите страницу." };

const endpointSchema = z.string().max(1024).refine(isPushEndpoint);
const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({ p256dh: z.string().max(100).refine(isUaPublicKey), auth: z.string().max(40).refine(isAuthSecret) }),
});

export const getPushPublicKey = () => vapidPublicKey();

/** Включено ли на этом устройстве: подписка с таким адресом есть у текущей сессии. */
export async function isMyDeviceSubscribed(owner: unknown, endpoint: unknown): Promise<boolean> {
  const { userId, sessionId } = await requireStudentSession();
  const e = endpointSchema.safeParse(endpoint);
  if (owner !== userId) return false;
  if (!e.success) return false;
  return (await prisma.pushSubscription.count({ where: { endpoint: e.data, userId, sessionId } })) > 0;
}

/** Подписать устройство. Адрес уникален: подписку другой живой сессии не перехватываем (зная чужой адрес, иначе
 * можно было бы забрать чужие уведомления); после выхода там строка удаляется каскадом и адрес свободен. */
export async function subscribeMyDevice(owner: unknown, input: unknown): Promise<PushResult> {
  const { userId, sessionId } = await requireStudentSession();
  if (owner !== userId) return STALE;
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Браузер прислал неподходящую подписку. Попробуйте другой браузер." };
  const { endpoint, keys } = parsed.data;
  const taken = await prisma.$transaction(async (tx) => {
    // Все регистрации — по очереди, одной блокировкой (ревью Codex 99–100): гонка двух входов за адрес, обход квоты
    // и перекрёстная перепривязка (A забирает подписку B, B — подписку A, очистка квоты упирается в чужую строку)
    // невозможны. Регистраций единицы — очередь незаметна.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('push:subscribe'))`;
    const existing = await tx.pushSubscription.findUnique({ where: { endpoint }, select: { sessionId: true, session: { select: { expiresAt: true } } } });
    if (existing && existing.sessionId !== sessionId && existing.session.expiresAt > new Date()) return true;
    await tx.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId, sessionId },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId, sessionId, createdAt: new Date() },
    });
    // Демо-аккаунты общие: не больше 20 устройств, самые старые уходят.
    const extra = await tx.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: PUSH_LIMIT.perUser, select: { id: true } });
    if (extra.length) await tx.pushSubscription.deleteMany({ where: { id: { in: extra.map((x) => x.id) } } });
    return false;
  });
  if (taken) return { ok: false, message: "Этот браузер уже получает уведомления другого входа. Выйдите там из кабинета и попробуйте снова." };
  return { ok: true, message: "Уведомления включены на этом устройстве." };
}

/** Выключить на этом устройстве — только подписку этого входа: другой вход общего аккаунта её не снимет. */
export async function unsubscribeMyDevice(owner: unknown, endpoint: unknown): Promise<PushResult> {
  const { userId, sessionId } = await requireStudentSession();
  if (owner !== userId) return STALE;
  const e = endpointSchema.safeParse(endpoint);
  if (e.success) await prisma.pushSubscription.deleteMany({ where: { endpoint: e.data, userId, sessionId } });
  return { ok: true, message: "Уведомления на этом устройстве выключены." };
}

/** Перед выходом: устройство больше не получает уведомления этого входа. Только подписка текущей сессии; если
 * Better Auth не удалит сессию при выходе (ошибку он глотает), строка уже удалена здесь (ревью Codex 98). */
export async function releaseMyDevice(endpoint: unknown): Promise<void> {
  const { sessionId } = await requireStudentSession();
  const e = endpointSchema.safeParse(endpoint);
  if (e.success) await prisma.pushSubscription.deleteMany({ where: { endpoint: e.data, sessionId } });
}

const lastTest = new Map<string, number>(); // в памяти: сервер — один процесс Node

/** Проверочное уведомление — только на это устройство (не всем, кто вошёл в общий демо-аккаунт). */
export async function sendMyTestPush(owner: unknown, endpoint: unknown): Promise<PushResult> {
  const { userId, sessionId } = await requireStudentSession();
  if (owner !== userId) return STALE;
  const e = endpointSchema.safeParse(endpoint);
  const sub = e.success ? await prisma.pushSubscription.findFirst({ where: { endpoint: e.data, userId, sessionId } }) : null;
  if (!sub) return { ok: false, message: "На этом устройстве уведомления не включены." };
  const now = Date.now();
  if (now - (lastTest.get(userId) ?? 0) < PUSH_LIMIT.testEveryMs) return { ok: false, message: "Проверочное можно отправить раз в 30 секунд." };
  lastTest.set(userId, now);
  const status = await deliver(sub, { title: "Уведомления работают", body: "Так придут переносы пар, статусы заявок и объявления.", url: "/notifications", tag: "test" });
  return status >= 200 && status < 300 ? { ok: true, message: "Отправлено — уведомление придёт через несколько секунд." } : { ok: false, message: "Служба уведомлений браузера не приняла сообщение. Выключите и включите снова." };
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(sub: Sub, message: Parameters<typeof sendPush>[1]) {
  const status = await sendPush(sub, message);
  // Подписка больше не существует (браузер отписался, приложение удалено) — убираем.
  if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
  return status;
}

/** На экране блокировки — только тип: заголовок уведомления может раскрыть личное (название справки, текст
 * объявления). Подробности — в кабинете после входа (ревью Codex 98). */
const LOCK_SCREEN_TITLE: Record<string, string> = {
  SCHEDULE_CHANGE: "Изменение в расписании",
  REQUEST_STATUS: "Новый статус заявки",
  ANNOUNCEMENT: "Новое уведомление",
};

/** Разослать push по новому уведомлению кабинета: подписки получателей, которые его не скрыли, в живых сессиях.
 * Перед каждой отправкой подписка перечитывается: за время рассылки уведомление могли отозвать или скрыть, из кабинета —
 * выйти (ревью Codex 99). По 4 одновременно. */
export async function pushNotification(notificationId: string): Promise<void> {
  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { kind: true, requestId: true, lesson: { select: { startsAt: true } }, recipients: { where: { hiddenAt: null }, select: { userId: true } } },
  });
  if (!n || !n.recipients.length) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: n.recipients.map((r) => r.userId) }, session: { expiresAt: { gt: new Date() } } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const message = { title: LOCK_SCREEN_TITLE[n.kind] ?? "Новое уведомление", body: "Откройте кабинет University, чтобы посмотреть.", url: notificationLink(n)?.href ?? "/notifications", tag: notificationId };
  const stillWanted = (id: string) =>
    prisma.pushSubscription.findFirst({
      where: { id, session: { expiresAt: { gt: new Date() } }, user: { notifications: { some: { notificationId, hiddenAt: null } } } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
  for (let i = 0; i < subs.length; i += 4) {
    await Promise.all(
      subs.slice(i, i + 4).map(async ({ id }) => {
        const sub = await stillWanted(id);
        if (sub) await deliver(sub, message);
      }),
    );
  }
}

/** После ответа (и коммита транзакции): действие сотрудника не ждёт служб Google и Apple. */
export function pushAfterResponse(notificationId: string | null | undefined): void {
  if (!notificationId) return;
  const run = () => pushNotification(notificationId).catch(() => undefined);
  try {
    after(run);
  } catch {
    void run(); // вне запроса (скрипты, тесты)
  }
}
