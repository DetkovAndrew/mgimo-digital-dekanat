// Число на значке приложения и метка аккаунта, для которого оно (docs/plans/push.md). Метка лежит в Cache Storage:
// её читает и service worker (public/sw.js), чтобы не поставить число из push прежнего аккаунта.

const STORE = "univ-badge";
const KEY = "/badge-owner";

// Операции идут по очереди, а очистка делает устаревшими все ещё не начатые обновления: иначе запоздавшая запись
// прежнего аккаунта легла бы после выхода (ревью Codex 103).
let queue: Promise<void> = Promise.resolve();
let generation = 0;
const enqueue = (op: () => Promise<void>) => (queue = queue.then(op).catch(() => undefined));

export function setBadge(owner: string, count: number) {
  const gen = generation;
  return enqueue(async () => {
    if (gen !== generation) return;
    if (typeof caches !== "undefined") await (await caches.open(STORE)).put(KEY, new Response(owner));
    if (gen !== generation || !("setAppBadge" in navigator)) return;
    await (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge());
  });
}

/** Выход, истёкшая сессия: число прежнего аккаунта со значка убираем, метку стираем. */
export function clearBadge() {
  generation++;
  return enqueue(async () => {
    // Значок очищается, даже если хранилище отказало (ревью Codex 104).
    try {
      if (typeof caches !== "undefined") await caches.delete(STORE);
    } finally {
      if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
    }
  });
}
