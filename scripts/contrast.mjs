// Контраст пар токенов по WCAG 2.2 для светлой и тёмной темы (docs/design/DIRECTION.md).
// Читает значения прямо из src/app/globals.css, чтобы проверка не расходилась с темой.
// Запуск: node scripts/contrast.mjs — код выхода 1, если какая-то пара ниже порога.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

/** Тело первого блока `{…}` после совпадения `start` (с учётом вложенных скобок). */
function blockAfter(start) {
  const m = start.exec(css);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(m.index + m[0].length, i);
  }
  return null;
}
const vars = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const lightBody = blockAfter(/^:root\s*\{/m);
const darkMedia = blockAfter(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/);
const darkBody = darkMedia && /:root\s*\{([\s\S]*)\}/.exec(darkMedia)?.[1];
if (!lightBody || !darkBody) {
  console.error("Не найден блок :root светлой или тёмной темы в globals.css");
  process.exit(1);
}
const light = vars(lightBody);
const dark = vars(darkBody); // тёмная тема обязана задать каждый проверяемый токен сама, без наследования светлой

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [текст, фон, порог]: 4.5 — обычный текст, 3 — крупный текст и графика (полосы, иконки, рамки фокуса).
const pairs = [
  ...["ink", "ink-2", "ink-3", "brand"].flatMap((t) => ["surface", "page", "fill"].map((bg) => [t, bg, 4.5])),
  ["on-brand", "brand-fill", 4.5],
  ["on-brand", "bad-fill", 4.5],
  ["brand", "brand-soft", 4.5],
  ...["ok", "warn", "bad", "info"].flatMap((t) => [[t, `${t}-soft`, 4.5], [t, "surface", 4.5]]),
  ["brand-fill", "surface", 3],
  ["accent", "fill", 3],
  ["focus", "surface", 3],
  ["focus", "page", 3],
  ["focus-on-brand", "brand-fill", 3],
  ["field", "surface", 3],
  ["field", "page", 3],
  ...["lecture", "practice", "language", "consult", "sport"].flatMap((k) => [[`k-${k}`, `k-${k}-soft`, 4.5], [`k-${k}`, "surface", 4.5]]),
  // Схемы корпусов: номер аудитории (ink) и подписи (ink-2) на пастели.
  ...["hall", "class", "pc", "lab", "cowork", "meet", "wing-1", "wing-2", "wing-3", "service", "quiet"].flatMap((m) => [["ink", `m-${m}`, 4.5], ["ink-2", `m-${m}`, 4.5]]),
];

let failed = 0;
for (const [name, theme] of [["светлая", light], ["тёмная", dark]]) {
  console.log(`\n${name} тема`);
  const missing = [...new Set(pairs.flat().filter((x) => typeof x === "string"))].filter((t) => !/^#[0-9a-f]{6}$/i.test(theme[t] ?? ""));
  if (missing.length) {
    console.error(`FAIL  нет токенов или не #rrggbb: ${missing.join(", ")}`);
    failed += missing.length;
    continue;
  }
  for (const [fg, bg, min] of pairs) {
    const r = ratio(theme[fg], theme[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? "  ok " : "FAIL "} ${fg.padEnd(10)} на ${bg.padEnd(11)} ${r.toFixed(2).padStart(5)}:1  (нужно ${min})`);
  }
}
process.exitCode = failed ? 1 : 0;
