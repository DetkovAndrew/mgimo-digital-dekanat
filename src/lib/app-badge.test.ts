import { describe, expect, it, vi } from "vitest";

// Гонка из ревью Codex 103: запоздавшая запись прежнего аккаунта не должна лечь на значок после выхода.
describe("число на значке", () => {
  it("выход отменяет ещё не выполненное обновление прежнего аккаунта", async () => {
    let release!: () => void;
    let entered!: () => void;
    const slow = new Promise<void>((r) => (release = r));
    const inPut = new Promise<void>((r) => (entered = r));
    const store = new Map<string, string>();
    const badge: number[] = [];
    vi.stubGlobal("caches", {
      open: async () => ({ put: async (k: string, r: Response) => (entered(), await slow, store.set(k, await r.text())) }),
      delete: async () => (deleteFails ? Promise.reject(new Error("quota")) : store.clear()),
    });
    vi.stubGlobal("navigator", { setAppBadge: async (n: number) => void badge.push(n), clearAppBadge: async () => void badge.push(0) });
    let deleteFails = false;
    const { clearBadge, setBadge } = await import("./app-badge");

    const first = setBadge("прежний", 17);
    await inPut; // запись метки началась и «зависла»
    const second = setBadge("прежний", 18); // ещё не начато
    const cleared = clearBadge();
    release();
    await Promise.all([first, second, cleared]);
    expect(badge.at(-1)).toBe(0); // последним — очистка
    expect(badge).not.toContain(17); // запись метки завершилась после выхода — число прежнего аккаунта не поставлено
    expect(badge).not.toContain(18);
    expect(store.size).toBe(0);

    await setBadge("новый", 3); // вход другим аккаунтом
    expect(badge.at(-1)).toBe(3);
    expect(store.get("/badge-owner")).toBe("новый");

    deleteFails = true; // хранилище отказало — значок всё равно очищен
    await clearBadge();
    expect(badge.at(-1)).toBe(0);
    vi.unstubAllGlobals();
  });
});
