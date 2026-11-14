import { renderSVG } from "uqr";

// Wi-Fi кампуса (демо, docs/plans/services.md): сети вымышлены, настройки — как в типичной вузовской сети.

export const WIFI_SSID = "University";
export const GUEST_SSID = "University Guest";
export const WIFI_COOLDOWN_MIN = 10;
/** RADIUS-сервер для проверки сертификата при подключении (зарезервированный домен .example). */
export const WIFI_RADIUS_DOMAIN = "radius.university.example";

/** Экранирование для QR Wi-Fi: \ ; , : " (формат WIFI:… понимают камеры Android и iPhone). */
const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
export const wifiQrPayload = (ssid: string, password: string) => `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;`;

/** QR как data URI (чёрный на белом в обеих темах, как у пропуска): без вставки SVG-строки в HTML. */
export function wifiQrSource(payload: string): string {
  const svg = renderSVG(payload, { ecc: "M", border: 4, pixelSize: 6, whiteColor: "#ffffff", blackColor: "#000000" });
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
