// Service worker кабинета University: только уведомления на телефон (docs/plans/push.md). Страницы не кеширует.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const text = (v, fallback) => (typeof v === "string" && v ? v.slice(0, 200) : fallback);
  // Число новых уведомлений на значке приложения (iPhone с экрана «Домой», установленный сайт на компьютере) — только
  // если push для того, кто сейчас вошёл на устройстве: метку кладёт кабинет (src/lib/app-badge.ts), выход её стирает.
  const count = Number.isInteger(data.badge) && data.badge >= 0 ? Math.min(data.badge, 999) : null;
  const badge = (async () => {
    if (count === null || typeof data.owner !== "string" || !self.navigator.setAppBadge) return;
    const owner = await (await (await caches.open("univ-badge")).match("/badge-owner"))?.text();
    if (owner !== data.owner) return;
    await (count ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge());
  })().catch(() => undefined);
  event.waitUntil(
    Promise.all([
      badge,
      self.registration.showNotification(text(data.title, "University"), {
        body: text(data.body, "Откройте кабинет University, чтобы посмотреть."),
        icon: "/brand/icon-192.png",
        badge: "/brand/icon-192.png",
        tag: text(data.tag, undefined),
        data: { url: data.url },
      }),
    ]),
  );
});

// Открыть только страницу этого же сайта: путь «/\evil.example» или «//evil.example» браузер понял бы как чужой адрес.
function sameOriginUrl(raw) {
  try {
    const url = new URL(typeof raw === "string" ? raw : "/notifications", self.location.origin);
    return url.origin === self.location.origin ? url.href : `${self.location.origin}/notifications`;
  } catch {
    return `${self.location.origin}/notifications`;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = sameOriginUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        try {
          return await client.navigate(url);
        } catch {
          break; // окно не под этим worker — откроем новое
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
