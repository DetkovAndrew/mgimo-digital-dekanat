// Браузерная часть уведомлений на телефон (docs/plans/push.md): поддержка, worker, текущая подписка.

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** iPhone/iPad в обычной вкладке Safari: push на iOS 16.4+ есть только у сайта, открытого с экрана «Домой». */
export function isIosBrowserTab() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export const registerPushWorker = () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export function urlBase64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Подписка сделана с этим ключом сервера? После смены секрета на сервере её надо пересоздать. */
export function sameKey(sub: PushSubscription, publicKey: string) {
  const key = sub.options.applicationServerKey;
  if (!key) return false;
  const a = new Uint8Array(key);
  const b = urlBase64ToBytes(publicKey);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
