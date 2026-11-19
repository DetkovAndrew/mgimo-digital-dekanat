// Удаление уведомлений у себя (ревью Codex 90): скрывается только своя доставка общего уведомления, «Вернуть» отменяет
// именно свою операцию (метка hiddenAt), чужое не скрывается и не возвращается, мусор во входе — отказ.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { countMyUnread, hideMyNotifications, listMyNotifications, restoreMyNotifications } from "@/server/dal/notifications";
import { actAs as login } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

type Who = Awaited<ReturnType<typeof login>>;
/** Вход и запоминание, под кем сессия: экран списка открыт тем же студентом. */
const actAs = async (u: string): Promise<Who> => (current = await login(u));
let A: Who;
let B: Who;
let current: Who;
const made: string[] = [];

async function notify(title: string, users: Who[]) {
  const n = await prisma.notification.create({
    data: { kind: "ANNOUNCEMENT", title, body: "Тест удаления", publishedAt: new Date(Date.now() - 60_000), recipients: { create: users.map((u) => ({ userId: u.userId })) } },
  });
  made.push(n.id);
  return n.id;
}
/** Владелец открытого списка — тот, под кем сейчас сессия. */
const me = () => current.userId;
const rowOf = (id: string, who: Who) => prisma.notificationRecipient.findUniqueOrThrow({ where: { notificationId_userId: { notificationId: id, userId: who.userId } } });

beforeAll(async () => {
  B = await actAs("timur.orlov");
  A = await actAs("alina.lebedeva");
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { id: { in: made } } });
  await prisma.$disconnect();
});

describe("удаление уведомлений у себя", () => {
  it("общее: скрыто только у Алины — у Тимура в списке; чужое Тимура не скрывается", async () => {
    const shared = await notify("Общее объявление", [A, B]);
    const onlyB = await notify("Только Тимуру", [B]);
    await actAs("alina.lebedeva");
    const unreadBefore = await countMyUnread();
    const r = await hideMyNotifications([shared, onlyB], me());
    expect(r.ok && r.ids).toEqual([shared]);
    expect((await rowOf(shared, A)).hiddenAt).not.toBeNull();
    expect((await rowOf(shared, B)).hiddenAt).toBeNull();
    expect((await rowOf(onlyB, B)).hiddenAt).toBeNull();
    expect((await listMyNotifications()).map((n) => n.id)).not.toContain(shared);
    expect(await countMyUnread()).toBe(unreadBefore - 1);

    await actAs("timur.orlov");
    expect((await listMyNotifications()).map((n) => n.id)).toEqual(expect.arrayContaining([shared, onlyB]));
    // Повторное удаление уже скрытого — пустой список, не ошибка.
    await actAs("alina.lebedeva");
    const again = await hideMyNotifications([shared], me());
    expect(again.ok && again.ids).toEqual([]);
  });

  it("«Вернуть»: только своя операция — устаревшая метка и чужая доставка не возвращаются", async () => {
    const id = await notify("Вернуть", [A, B]);
    await actAs("alina.lebedeva");
    const first = await hideMyNotifications([id], me());
    if (!first.ok) throw new Error(first.error);
    expect((await restoreMyNotifications({ ids: [id], at: first.at }, me())).count).toBe(1);
    await new Promise((r) => setTimeout(r, 5));
    const second = await hideMyNotifications([id], me());
    if (!second.ok) throw new Error(second.error);
    // Запоздалое «Вернуть» от первого удаления не отменяет второе.
    expect((await restoreMyNotifications({ ids: [id], at: first.at }, me())).count).toBe(0);
    expect((await rowOf(id, A)).hiddenAt).not.toBeNull();

    // Тимур скрыл у себя; Алина с его меткой и id ничего не возвращает.
    await actAs("timur.orlov");
    const timur = await hideMyNotifications([id], me());
    if (!timur.ok) throw new Error(timur.error);
    await actAs("alina.lebedeva");
    expect((await restoreMyNotifications({ ids: [id], at: timur.at }, me())).count).toBe(0);
    expect((await rowOf(id, B)).hiddenAt).not.toBeNull();
    await actAs("timur.orlov");
    expect((await restoreMyNotifications({ ids: [id], at: timur.at }, me())).count).toBe(1);
  });

  it("отозванное до «Вернуть»: доставка не появляется заново", async () => {
    const id = await notify("Отзовут", [A, B]);
    await actAs("alina.lebedeva");
    const r = await hideMyNotifications([id], me());
    if (!r.ok) throw new Error(r.error);
    await prisma.notification.delete({ where: { id } });
    expect((await restoreMyNotifications({ ids: [id], at: r.at }, me())).count).toBe(0);
    expect(await prisma.notificationRecipient.count({ where: { notificationId: id } })).toBe(0);
  });

  it("экран другого аккаунта: owner не совпал с сессией — отказ, ничего не скрыто и не возвращено", async () => {
    const id = await notify("Чужой экран", [A, B]);
    await actAs("timur.orlov"); // в соседней вкладке вошёл Тимур, а экран Алины остался открытым
    const r = await hideMyNotifications([id], A.userId);
    expect(r.ok).toBe(false);
    expect((await rowOf(id, B)).hiddenAt).toBeNull();
    const mine = await hideMyNotifications([id], B.userId);
    if (!mine.ok) throw new Error(mine.error);
    expect((await restoreMyNotifications({ ids: [id], at: mine.at }, A.userId)).ok).toBe(false);
    expect((await rowOf(id, B)).hiddenAt).not.toBeNull();
  });

  it("мусор во входе — отказ без изменений", async () => {
    await actAs("alina.lebedeva");
    for (const bad of [[], "abc", [42], ["'; DROP TABLE notification; --"], Array.from({ length: 101 }, (_, i) => `c${String(i).padStart(24, "0")}`), null])
      expect((await hideMyNotifications(bad, me())).ok).toBe(false);
    for (const bad of [{ ids: ["c".repeat(25)], at: "вчера" }, { ids: [], at: new Date().toISOString() }, null])
      expect((await restoreMyNotifications(bad, me())).ok).toBe(false);
  });
});
