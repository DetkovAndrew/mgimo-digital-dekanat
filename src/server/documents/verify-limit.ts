import "server-only";

// Лимит открытой страницы проверки справки: не защита от перебора (токен 128 бит), а от лишней нагрузки на БД.
// Счётчики в памяти: сервер работает одним процессом Node (как лимиты помощника).

const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

/** Скользящее окно в минуту на ключ (адрес клиента). Тот же лимит у подписки на календарь (/api/calendar/feed). */
export function slidingLimiter(perWindow: number) {
  const hits = new Map<string, number[]>();
  return function take(key: string, now = Date.now()): boolean {
    if (hits.size >= MAX_KEYS && !hits.has(key)) {
      for (const [k, list] of hits) if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(k);
      // Поток с тысяч адресов: лучше сбросить счётчики, чем закрыть проверку всем.
      if (hits.size >= MAX_KEYS) hits.clear();
    }
    const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (list.length >= perWindow) {
      hits.set(key, list);
      return false;
    }
    list.push(now);
    hits.set(key, list);
    return true;
  };
}

export const takeVerifySlot = slidingLimiter(30);

/** Адрес клиента: Caddy перезаписывает X-Forwarded-For адресом соединения (недоверенным прокси не верит). */
export const clientKey = (forwardedFor: string | null) => forwardedFor?.split(",")[0]?.trim() || "local";
