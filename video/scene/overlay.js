// 2D-слои кадра поверх и под 3D: размытый фон со светлыми пятнами, подписи, знак University, финальная карточка.
// Все размеры — в координатах 1920×1080, холст масштабируется целиком.

const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, t) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(mix(v, y[i], t))).join(",")})`;
};
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const smooth = (a, b, t) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;

/** Фон: мягкий градиент и размытые световые пятна; night 0..1 — гасим свет. */
export function drawBackground(g, t, night, variant) {
  const top = mixHex(variant === "laptop" ? "#eef0f8" : "#f3f4fb", "#06080f", night);
  const bottom = mixHex(variant === "laptop" ? "#dde1ee" : "#e2e6f6", "#0b0e1a", night);
  const grad = g.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1920, 1080);
  const orbs = [
    { x: 1450, y: 300, r: 560, c: [59, 76, 202], a: 0.2, sx: 0.11, sy: 0.07 },
    { x: 420, y: 820, r: 620, c: [140, 102, 235], a: 0.16, sx: 0.08, sy: 0.12 },
    { x: 1700, y: 900, r: 480, c: [236, 130, 190], a: 0.12, sx: 0.13, sy: 0.09 },
    { x: 260, y: 160, r: 420, c: [80, 190, 200], a: 0.1, sx: 0.09, sy: 0.1 },
  ];
  for (const o of orbs) {
    const x = o.x + Math.sin(t * o.sx * 2 * Math.PI * 0.35) * 60;
    const y = o.y + Math.cos(t * o.sy * 2 * Math.PI * 0.35) * 40;
    const a = o.a * mix(1, 0.35, night);
    const rg = g.createRadialGradient(x, y, 0, x, y, o.r);
    rg.addColorStop(0, `rgba(${o.c.join(",")},${a})`);
    rg.addColorStop(1, `rgba(${o.c.join(",")},0)`);
    g.fillStyle = rg;
    g.fillRect(0, 0, 1920, 1080);
  }
}

/** Знак University (src/components/university-mark.tsx) в квадрате size. */
export function drawMark(g, x, y, size, fill = "#3b4cca") {
  const s = size / 64;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(0, 0, 64, 64, 16);
  g.fill();
  g.fillStyle = "#ffffff";
  g.fill(new Path2D("M14 14H23V35C23 42 27 46 32 46C37 46 41 42 41 35V27H50V35C50 47 43 55 32 55C21 55 14 47 14 35V14Z"));
  g.beginPath();
  g.roundRect(41, 12, 9, 9, 2);
  g.fill();
  g.restore();
}

export function drawBrand(g, alpha, night) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  drawMark(g, 72, 60, 56, night > 0.5 ? "#4b5bd8" : "#3b4cca");
  g.fillStyle = mixHex("#171b2b", "#eceef2", night);
  g.font = "600 27px Onest";
  g.textBaseline = "alphabetic";
  g.fillText("University", 144, 86);
  g.fillStyle = mixHex("#4c5570", "#a7aec4", night);
  g.font = "400 21px Onest";
  g.fillText("Цифровой деканат", 144, 113);
  g.restore();
}

/** Подпись: появляется сдвигом вверх, уходит растворением. align: "left" | "center". */
export function drawCaption(g, t, { start, end, title, sub, align = "left", x = 140, y = 470, night = 0, size = 76 }) {
  if (t < start || t > end) return;
  const a = easeOut((t - start) / 0.45) * (1 - smooth(end - 0.3, end, t));
  if (a <= 0) return;
  const dy = (1 - easeOut((t - start) / 0.55)) * 34;
  g.save();
  g.globalAlpha = a;
  g.textAlign = align;
  g.textBaseline = "alphabetic";
  g.fillStyle = mixHex("#171b2b", "#eceef2", night);
  g.font = `600 ${size}px Onest`;
  const lines = title.split("\n");
  lines.forEach((line, i) => g.fillText(line, x, y + dy + i * size * 1.08));
  if (sub) {
    g.fillStyle = mixHex("#4c5570", "#a7aec4", night);
    g.font = "400 34px Onest";
    const subDy = (1 - easeOut((t - start - 0.08) / 0.55)) * 34;
    sub.split("\n").forEach((line, i) => g.fillText(line, x, y + subDy + (lines.length - 1) * size * 1.08 + 66 + i * 44));
  }
  g.restore();
}

export function drawEndCard(g, t, start) {
  if (t < start) return;
  const a = smooth(start, start + 0.7, t);
  g.save();
  g.fillStyle = `rgba(6,8,15,${0.8 * a})`;
  g.fillRect(0, 0, 1920, 1080);
  const k = easeOut((t - start - 0.15) / 0.8);
  g.globalAlpha = k;
  const dy = (1 - k) * 30;
  drawMark(g, 960 - 56, 300 + dy, 112, "#4b5bd8");
  g.textAlign = "center";
  g.fillStyle = "#eceef2";
  g.font = "600 84px Onest";
  g.fillText("Цифровой деканат", 960, 520 + dy);
  g.fillStyle = "#a7aec4";
  g.font = "400 36px Onest";
  g.fillText("Личный кабинет студента University", 960, 584 + dy);
  g.fillStyle = "#a3adff";
  g.font = "600 34px Onest";
  g.fillText("university-dekanat.duckdns.org", 960, 680 + dy);
  g.fillStyle = "#7d859c";
  g.font = "400 22px Onest";
  g.fillText("Концепт для конкурса MGIMO AI Challenge 2026. Не является официальным сервисом какого-либо вуза.", 960, 960 + dy);
  g.fillText("Все данные вымышлены.", 960, 992 + dy);
  g.restore();
}

export function drawFlash(g, amount) {
  if (amount <= 0) return;
  g.fillStyle = `rgba(255,255,255,${amount})`;
  g.fillRect(0, 0, 1920, 1080);
}

export function drawFade(g, amount) {
  if (amount <= 0) return;
  g.fillStyle = `rgba(0,0,0,${amount})`;
  g.fillRect(0, 0, 1920, 1080);
}
