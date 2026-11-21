// Уведомления на телефон (docs/plans/push.md, ревью Codex 98): подписка принадлежит сессии студента, чужую живую не
// перехватить, чужим адресом не отписать и не прислать проверочное; рассылка — только получателям, не скрывшим
// уведомление, в живых сессиях; выход (удаление сессии) удаляет подписку. Службы push не вызываются — sendPush подменён.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { PUSH_LIMIT, pushNotification, releaseMyDevice, sendMyTestPush, subscribeMyDevice, unsubscribeMyDevice } from "@/server/dal/push";
import { sendPush } from "@/server/push/webpush";
import * as session from "@/server/session";
import { actAs } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStudentSession: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));
vi.mock("@/server/push/webpush", async (orig) => ({ ...(await orig<typeof import("@/server/push/webpush")>()), sendPush: vi.fn(async () => 201) }));

const KEYS = { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" };
const endpoint = (tag: string) => `https://fcm.googleapis.com/fcm/send/push-test-${tag}-${crypto.randomUUID()}`;

type Who = Awaited<ReturnType<typeof actAs>> & { sessionId: string };
let A: Who;
let B: Who;
const sessions: string[] = [];
const notifications: string[] = [];

async function newSession(u: Awaited<ReturnType<typeof actAs>>, expiresAt = new Date(Date.now() + 3600_000)): Promise<Who> {
  const id = `push-test-${crypto.randomUUID()}`;
  await prisma.session.create({ data: { id, token: id, userId: u.userId, expiresAt } });
  sessions.push(id);
  return { ...u, sessionId: id };
}
/** Сессия «вошедшего» для DAL. */
function login(who: Who) {
  vi.mocked(session.requireStudent).mockResolvedValue(Object.freeze({ userId: who.userId, studentId: who.studentId, groupId: who.groupId }));
  vi.mocked(session.requireStudentSession).mockResolvedValue({ userId: who.userId, studentId: who.studentId, groupId: who.groupId, sessionId: who.sessionId });
}
const rowOf = (e: string) => prisma.pushSubscription.findUnique({ where: { endpoint: e } });
async function notify(users: Who[], hiddenFor: Who[] = []) {
  const n = await prisma.notification.create({
    data: { kind: "ANNOUNCEMENT", title: "Секрет в заголовке", body: "Тест push", recipients: { create: users.map((u) => ({ userId: u.userId, hiddenAt: hiddenFor.includes(u) ? new Date() : null })) } },
  });
  notifications.push(n.id);
  return n.id;
}
const sentTo = () => vi.mocked(sendPush).mock.calls.map(([t]) => t.endpoint);

beforeAll(async () => {
  A = await newSession(await actAs("alina.lebedeva"));
  B = await newSession(await actAs("timur.orlov"));
});

beforeEach(() => vi.mocked(sendPush).mockClear());

afterAll(async () => {
  await prisma.pushSubscription.deleteMany({ where: { sessionId: { in: sessions } } });
  await prisma.session.deleteMany({ where: { id: { in: sessions } } });
  await prisma.notification.deleteMany({ where: { id: { in: notifications } } });
  await prisma.$disconnect();
});

describe("подписка устройства", () => {
  it("владелец и сессия — из сессии; мусор и чужие адреса — отказ", async () => {
    login(A);
    const e = endpoint("a");
    expect((await subscribeMyDevice(A.userId, { endpoint: e, keys: KEYS })).ok).toBe(true);
    expect(await rowOf(e)).toMatchObject({ userId: A.userId, sessionId: A.sessionId });
    for (const bad of [{ endpoint: "https://evil.example/x", keys: KEYS }, { endpoint: "http://fcm.googleapis.com/x", keys: KEYS }, { endpoint: endpoint("k"), keys: { ...KEYS, auth: "AAAA" } }, null, "x"]) {
      expect((await subscribeMyDevice(A.userId, bad)).ok).toBe(false);
    }
  });

  it("экран открыт под другим аккаунтом — ничего не меняется", async () => {
    login(A);
    const e = endpoint("stale");
    expect((await subscribeMyDevice(B.userId, { endpoint: e, keys: KEYS })).ok).toBe(false);
    expect(await rowOf(e)).toBeNull();
  });

  it("чужую живую подписку не перехватить, не выключить, проверочное на неё не уходит", async () => {
    login(A);
    const e = endpoint("taken");
    await subscribeMyDevice(A.userId, { endpoint: e, keys: KEYS });
    login(B);
    expect((await subscribeMyDevice(B.userId, { endpoint: e, keys: KEYS })).ok).toBe(false);
    await unsubscribeMyDevice(B.userId, e);
    await releaseMyDevice(e);
    expect((await sendMyTestPush(B.userId, e)).ok).toBe(false);
    expect(await rowOf(e)).toMatchObject({ userId: A.userId, sessionId: A.sessionId });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("после истечения прежней сессии устройство переходит к новому входу", async () => {
    const old = await newSession(A, new Date(Date.now() - 1000));
    login(old);
    const e = endpoint("expired");
    await prisma.pushSubscription.create({ data: { endpoint: e, ...KEYS, userId: old.userId, sessionId: old.sessionId } });
    login(B);
    expect((await subscribeMyDevice(B.userId, { endpoint: e, keys: KEYS })).ok).toBe(true);
    expect(await rowOf(e)).toMatchObject({ userId: B.userId, sessionId: B.sessionId });
  });

  it("выход: удаление сессии удаляет подписку; releaseMyDevice — только своей сессии", async () => {
    const s = await newSession(A);
    login(s);
    const e1 = endpoint("logout");
    const e2 = endpoint("release");
    await subscribeMyDevice(A.userId, { endpoint: e1, keys: KEYS });
    await subscribeMyDevice(A.userId, { endpoint: e2, keys: KEYS });
    await releaseMyDevice(e2);
    expect(await rowOf(e2)).toBeNull();
    await prisma.session.delete({ where: { id: s.sessionId } });
    expect(await rowOf(e1)).toBeNull();
  });

  it(`не больше ${PUSH_LIMIT.perUser} устройств: самое старое уходит`, async () => {
    const s = await newSession(B);
    login(s);
    const first = endpoint("limit-first");
    await subscribeMyDevice(B.userId, { endpoint: first, keys: KEYS });
    await prisma.pushSubscription.update({ where: { endpoint: first }, data: { createdAt: new Date(Date.now() - 86_400_000) } });
    for (let i = 0; i < PUSH_LIMIT.perUser; i++) await subscribeMyDevice(B.userId, { endpoint: endpoint(`limit-${i}`), keys: KEYS });
    expect(await rowOf(first)).toBeNull();
    expect(await prisma.pushSubscription.count({ where: { userId: B.userId } })).toBe(PUSH_LIMIT.perUser);
    await prisma.pushSubscription.deleteMany({ where: { sessionId: s.sessionId } });
  });
});

describe("параллельные регистрации (ревью Codex 99)", () => {
  it("один адрес из двух входов одновременно — достаётся одному", async () => {
    const e = endpoint("race");
    const as = (who: Who) => {
      login(who);
      return subscribeMyDevice(who.userId, { endpoint: e, keys: KEYS });
    };
    const [ra, rb] = await Promise.all([as(A), as(B)]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    const row = await rowOf(e);
    expect(row?.userId).toBe(ra.ok ? A.userId : B.userId);
  });

  it(`квота ${PUSH_LIMIT.perUser} держится и при одновременных регистрациях`, async () => {
    const s = await newSession(B);
    login(s);
    for (let i = 0; i < PUSH_LIMIT.perUser - 1; i++) await prisma.pushSubscription.create({ data: { endpoint: endpoint(`q-${i}`), ...KEYS, userId: B.userId, sessionId: s.sessionId } });
    await Promise.all([1, 2, 3].map((i) => subscribeMyDevice(B.userId, { endpoint: endpoint(`q-par-${i}`), keys: KEYS })));
    expect(await prisma.pushSubscription.count({ where: { userId: B.userId } })).toBe(PUSH_LIMIT.perUser);
    await prisma.pushSubscription.deleteMany({ where: { userId: B.userId } });
  });

  it("перекрёстная перепривязка при полной квоте — без взаимоблокировки", async () => {
    const [a, b] = [await newSession(A), await newSession(B)];
    const [aOld, bOld] = [await newSession(A, new Date(Date.now() - 1000)), await newSession(B, new Date(Date.now() - 1000))];
    const x = endpoint("cross-x");
    const y = endpoint("cross-y");
    const old = new Date(Date.now() - 86_400_000);
    await prisma.pushSubscription.create({ data: { endpoint: x, ...KEYS, userId: A.userId, sessionId: aOld.sessionId, createdAt: old } });
    await prisma.pushSubscription.create({ data: { endpoint: y, ...KEYS, userId: B.userId, sessionId: bOld.sessionId, createdAt: old } });
    for (const [who, s] of [[A, a], [B, b]] as const) {
      for (let i = 0; i < PUSH_LIMIT.perUser - 1; i++) await prisma.pushSubscription.create({ data: { endpoint: endpoint(`cross-${i}`), ...KEYS, userId: who.userId, sessionId: s.sessionId } });
    }
    const as = (who: Who, e: string) => {
      login(who);
      return subscribeMyDevice(who.userId, { endpoint: e, keys: KEYS });
    };
    const [ra, rb] = await Promise.all([as(a, y), as(b, x)]);
    expect(ra.ok && rb.ok).toBe(true);
    expect(await rowOf(y)).toMatchObject({ userId: A.userId });
    expect(await rowOf(x)).toMatchObject({ userId: B.userId });
    for (const who of [A, B]) expect(await prisma.pushSubscription.count({ where: { userId: who.userId } })).toBeLessThanOrEqual(PUSH_LIMIT.perUser);
    await prisma.pushSubscription.deleteMany({ where: { sessionId: { in: [a.sessionId, b.sessionId, aOld.sessionId, bOld.sessionId] } } });
  });

  it("выключить может только этот вход: другой вход того же аккаунта не снимет", async () => {
    login(A);
    const e = endpoint("other-login");
    await subscribeMyDevice(A.userId, { endpoint: e, keys: KEYS });
    const second = await newSession(A);
    login(second);
    await unsubscribeMyDevice(A.userId, e);
    expect(await rowOf(e)).toMatchObject({ sessionId: A.sessionId });
  });
});

describe("рассылка по уведомлению", () => {
  it("только получателям, не скрывшим его, в живых сессиях; на экране блокировки — без заголовка", async () => {
    login(A);
    const ea = endpoint("deliver-a");
    await subscribeMyDevice(A.userId, { endpoint: ea, keys: KEYS });
    login(B);
    const eb = endpoint("deliver-b");
    await subscribeMyDevice(B.userId, { endpoint: eb, keys: KEYS });
    const dead = await newSession(A, new Date(Date.now() - 1000));
    const ed = endpoint("deliver-dead");
    await prisma.pushSubscription.create({ data: { endpoint: ed, ...KEYS, userId: A.userId, sessionId: dead.sessionId } });

    await pushNotification(await notify([A]));
    expect(sentTo()).toContain(ea);
    expect(sentTo()).not.toContain(eb);
    expect(sentTo()).not.toContain(ed);
    const message = vi.mocked(sendPush).mock.calls[0][1];
    expect(message.title).not.toContain("Секрет");
    expect(message.url).toBe("/notifications");

    vi.mocked(sendPush).mockClear();
    await pushNotification(await notify([A, B], [A]));
    expect(sentTo()).toContain(eb);
    expect(sentTo()).not.toContain(ea);
  });

  it("служба ответила 410 — подписка удаляется", async () => {
    login(A);
    const e = endpoint("gone");
    await subscribeMyDevice(A.userId, { endpoint: e, keys: KEYS });
    vi.mocked(sendPush).mockResolvedValue(410);
    await pushNotification(await notify([A]));
    vi.mocked(sendPush).mockResolvedValue(201);
    expect(await rowOf(e)).toBeNull();
  });
});
