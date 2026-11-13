import { renderSVG } from "uqr";

export const PASS_QR_SIZE = 222;

/**
 * QR — машинно читаемое изображение с постоянными чёрным/белым цветами в обеих темах.
 * Версия 3, M, 6 px на модуль и тихая зона 4 модуля: итоговый размер 222×222.
 * Используем img/data URI, без вставки строки SVG в HTML и без внешнего сервиса.
 */
export function passQrSource(payload: string): string {
  const svg = renderSVG(payload, {
    ecc: "M",
    boostEcc: false,
    minVersion: 3,
    maxVersion: 3,
    border: 4,
    pixelSize: 6,
    whiteColor: "#ffffff",
    blackColor: "#000000",
  });
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
