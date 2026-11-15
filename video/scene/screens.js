// Экраны: кадры снимков сайта → холст → текстура. Телефон: строка состояния, смена страниц сдвигом, касание.
// Ноутбук: смена снимков, подсветка строки, круговое включение тёмной темы.
import * as THREE from "three";

const cache = new Map();
/** Картинка по адресу; держим немного последних, чтобы не съесть память на сотнях кадров. */
export async function image(url) {
  if (cache.has(url)) {
    const v = cache.get(url);
    cache.delete(url);
    cache.set(url, v);
    return v;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`нет ${url}`);
  const bmp = await createImageBitmap(await res.blob());
  cache.set(url, bmp);
  while (cache.size > 48) {
    const [k, old] = cache.entries().next().value;
    if (k.includes("/flow/")) {
      cache.delete(k);
      cache.set(k, old); // снимки ноутбука и карточки нужны до конца
      continue;
    }
    old.close?.();
    cache.delete(k);
  }
  return bmp;
}

export const frameUrl = (seq, i) => `/captures/phone/${seq}/${String(i).padStart(4, "0")}.jpg`;

const SB = 88; // строка состояния 44 CSS px при DPR 2

export class PhoneScreen {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 780;
    this.canvas.height = 1600 + SB;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
  }

  /** cur/prev — картинки страниц, slide 0..1 — сдвиг prev влево и cur справа; tap — {x, y, p} в пикселях холста. */
  draw({ cur, prev, slide = 1, tap = null }) {
    const g = this.ctx;
    const w = this.canvas.width;
    g.fillStyle = "#f1f3fa";
    g.fillRect(0, 0, w, this.canvas.height);
    if (prev && slide < 1) {
      const e = 1 - (1 - slide) ** 3;
      g.drawImage(prev, -e * w * 0.28, SB);
      g.fillStyle = `rgba(23,27,43,${0.12 * e})`;
      g.fillRect(0, SB, w, 1600);
      const x = (1 - e) * w;
      g.save();
      g.shadowColor = "rgba(23,27,43,0.25)";
      g.shadowBlur = 40;
      g.fillStyle = "#f1f3fa";
      g.fillRect(x, SB, w, 1600);
      g.restore();
      g.drawImage(cur, x, SB);
    } else {
      g.drawImage(cur, 0, SB);
    }
    // Цвет строки состояния — как верх страницы под ней.
    const [r, gg, b] = g.getImageData(6, SB + 2, 1, 1).data;
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(0, 0, w, SB);
    this.statusBar(g, w);
    if (tap && tap.p > 0 && tap.p < 1) {
      const rad = 24 + tap.p * 120;
      g.fillStyle = `rgba(255,255,255,${0.45 * (1 - tap.p)})`;
      g.beginPath();
      g.arc(tap.x, tap.y, rad, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(23,27,43,${0.25 * (1 - tap.p)})`;
      g.lineWidth = 4;
      g.stroke();
    }
    this.texture.needsUpdate = true;
  }

  statusBar(g, w) {
    const ink = "#171b2b";
    g.fillStyle = ink;
    g.font = "600 30px Onest";
    g.textBaseline = "middle";
    g.fillText("10:24", 52, SB / 2 + 2);
    // Камера в экране.
    g.fillStyle = "#0b0c10";
    g.beginPath();
    g.arc(w / 2, SB / 2, 15, 0, Math.PI * 2);
    g.fill();
    // Сеть, Wi-Fi, батарея.
    const right = w - 50;
    g.fillStyle = ink;
    g.beginPath();
    g.roundRect(right - 52, SB / 2 - 12, 46, 24, 7);
    g.lineWidth = 3;
    g.strokeStyle = ink;
    g.stroke();
    g.fillRect(right - 48, SB / 2 - 8, 32, 16);
    g.fillRect(right - 4, SB / 2 - 5, 4, 10);
    const wx = right - 86;
    g.lineWidth = 4;
    g.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(wx, SB / 2 + 12, 6 + i * 8, -Math.PI * 0.75, -Math.PI * 0.25);
      g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const h = 8 + i * 5;
      g.fillRect(right - 150 + i * 9, SB / 2 + 11 - h, 6, h);
    }
  }
}

export class LaptopScreen {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 2560;
    this.canvas.height = 1600;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.key = "";
  }

  /** a — основной снимок; b + mix — второй поверх (плавно); slideTo + slide — сдвиг; reveal — круг тёмной темы. */
  draw(state, key) {
    if (key === this.key) return;
    this.key = key;
    const g = this.ctx;
    const { width: w, height: h } = this.canvas;
    if (state.slideTo && state.slide > 0) {
      const e = 1 - (1 - state.slide) ** 3;
      g.drawImage(state.a, -e * w * 0.25, 0);
      g.fillStyle = `rgba(23,27,43,${0.1 * e})`;
      g.fillRect(0, 0, w, h);
      g.drawImage(state.slideTo, (1 - e) * w, 0);
    } else {
      g.drawImage(state.a, 0, 0);
    }
    if (state.b && state.mix > 0) {
      g.globalAlpha = state.mix;
      g.drawImage(state.b, 0, 0);
      g.globalAlpha = 1;
    }
    if (state.ring && state.ring.p > 0 && state.ring.p < 1) {
      const { x, y, width, height } = state.ring.box;
      const p = state.ring.p;
      const grow = 6 + p * 18;
      g.strokeStyle = `rgba(59,76,202,${0.85 * Math.sin(Math.PI * p)})`;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect((x - grow / 2) * 2, (y - grow / 2) * 2, (width + grow) * 2, (height + grow) * 2, 28);
      g.stroke();
    }
    if (state.dark && state.reveal > 0) {
      const cx = w - 150;
      const cy = 120;
      const rad = Math.hypot(w, h) * (state.reveal ** 1.6);
      g.save();
      g.beginPath();
      g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.clip();
      g.drawImage(state.dark, 0, 0);
      g.restore();
    }
    this.texture.needsUpdate = true;
  }
}
