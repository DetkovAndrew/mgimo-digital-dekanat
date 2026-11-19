// Страница «Уже чиним» (deploy/errors/down.html). Её отдаёт Caddy, пока приложение не отвечает: перезапуск после
// выкатки или падение (handle_errors 502 503 504 в deploy/Caddyfile). Next в этот момент не работает, поэтому страница:
// готовый HTML без внешних файлов: сцена Инвиктии «чинит» из invictia-scenes.tsx (рисунок NursuUwU) отрисована в SVG,
// цвета: токены из globals.css, тема: тот же скрипт, что у сайта. Пересобрать: `npm run down-page`
// (тест tests/down-page.test.ts сверяет файл с этой сборкой, правка сцены или токенов без пересборки его роняет).
import { readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { InvictiaScene } from "../src/components/invictia-scenes";
import { themeScript } from "../src/lib/theme";

export const DOWN_PAGE = new URL("../deploy/errors/down.html", import.meta.url);
const GLOBALS = new URL("../src/app/globals.css", import.meta.url);

/** Переменные `--имя: значение` из первого блока с этим селектором. */
function tokens(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`В globals.css нет блока ${selector}`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return new Map([...body.matchAll(/^\s*--([a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
}

/** Классы fill-*, stroke-* (в том числе с прозрачностью «/60») и opacity-* из сцены → CSS на переменных темы. */
function sceneCss(svg: string, light: Map<string, string>): { css: string; used: Set<string> } {
  const used = new Set<string>();
  const rules = new Set<string>();
  for (const cls of new Set([...svg.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)))) {
    const op = /^opacity-(\d+)$/.exec(cls);
    if (op) {
      rules.add(`.${cls}{opacity:${Number(op[1]) / 100}}`);
      continue;
    }
    const m = /^(fill|stroke)-(.+?)(?:\/(\d+))?$/.exec(cls);
    if (!m) continue;
    if (m[2] === "none") {
      rules.add(`.${cls}{${m[1]}:none}`);
      continue;
    }
    if (!light.has(m[2])) throw new Error(`Класс ${cls}: токена --${m[2]} нет в :root`);
    used.add(m[2]);
    const color = m[3] ? `color-mix(in srgb, var(--${m[2]}) ${m[3]}%, transparent)` : `var(--${m[2]})`;
    rules.add(`.${cls.replace("/", "\\/")}{${m[1]}:${color}}`);
  }
  return { css: [...rules].join("\n"), used };
}

export function downPageHtml(): string {
  const css = readFileSync(GLOBALS, "utf8");
  const light = tokens(css, ":root");
  const dark = tokens(css, ':root[data-theme="dark"]');
  const svg = renderToStaticMarkup(<InvictiaScene name="error" className="scene" />);
  const scene = sceneCss(svg, light);
  const names = [...new Set(["page", "surface", "fill", "ink", "ink-2", "ink-3", "hairline", "brand", "brand-fill", "on-brand", "focus", ...scene.used])];
  const vars = (t: Map<string, string>) => names.map((n) => `--${n}:${t.get(n) ?? light.get(n)}`).join(";");

  // {{placeholder …}}: шаблон Caddy (директива templates): код ответа подставляет сервер. Других «{{» в файле нет.
  return `<!doctype html>
<html lang="ru" data-status="{{placeholder "http.error.status_code"}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>Уже чиним · Деканат University</title>
<link rel="icon" href="/brand/mark.svg" type="image/svg+xml">
<noscript><meta http-equiv="refresh" content="20"></noscript>
<script>${themeScript}</script>
<style>
/* ds-allow-hardcode: отдельная страница вне Tailwind, размеры повторяют шкалу text-micro/body/title из globals.css. */
:root{color-scheme:light;${vars(light)}}
@media screen{:root[data-theme="dark"]{color-scheme:dark;${vars(dark)}}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;background:var(--page);color:var(--ink);font:15px/1.5 Onest,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
aside{background:var(--fill);color:var(--ink-2);font-size:11px;line-height:1.35;text-align:center;padding:6px 16px}
main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 16px;max-width:28rem;margin:0 auto}
.scene{width:13rem;height:auto;overflow:visible;margin-bottom:16px}
h1{font-size:22px;line-height:1.25;font-weight:600;margin:0 0 8px}
p{margin:0}
.reason{color:var(--ink-2);margin-bottom:6px}
.wait{color:var(--ink-3);font-size:13px;margin-bottom:24px}
.wait span{display:inline-block;width:.5em;height:.5em;border-radius:50%;background:var(--brand);margin-right:.4em;vertical-align:.05em}
@media (prefers-reduced-motion:no-preference){.wait span{animation:blink 1.4s ease-in-out infinite}}
@keyframes blink{50%{opacity:.25}}
button{font:inherit;font-weight:600;min-height:44px;padding:0 20px;border:0;border-radius:12px;background:var(--brand-fill);color:var(--on-brand);cursor:pointer}
button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.code{margin-top:24px;color:var(--ink-3);font-size:11px}
${scene.css}
</style>
</head>
<body>
<aside aria-label="О сервисе">Концепт для конкурса MGIMO AI Challenge 2026. Не является официальным сервисом какого-либо вуза. Все данные вымышлены.</aside>
<main>
${svg}
<h1>Уже чиним</h1>
<p class="reason" id="reason">Сервер деканата не отвечает. Скорее всего, он перезапускается после обновления. Обычно это около минуты.</p>
<p class="wait" role="status" id="wait"><span aria-hidden="true"></span>Страница откроется сама, как только сервер вернётся</p>
<button type="button" onclick="location.reload()">Обновить сейчас</button>
<p class="code" id="code"></p>
</main>
<script>
(function () {
  var status = document.documentElement.getAttribute("data-status") || "";
  var reasons = {
    "502": "Сервер деканата не отвечает. Скорее всего, он перезапускается после обновления. Обычно это около минуты.",
    "503": "Сервер деканата временно недоступен: он запускается или перегружен.",
    "504": "Сервер деканата отвечает слишком долго."
  };
  if (reasons[status]) document.getElementById("reason").textContent = reasons[status];
  if (/^\\d{3}$/.test(status)) document.getElementById("code").textContent = "Код ответа: " + status + " · " + new Date().toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }) + " МСК";
  if (!navigator.onLine) document.getElementById("reason").textContent = "Нет подключения к интернету. Проверьте сеть на устройстве.";
  // Сервер вернулся, если /api/health отвечает 200 (пока приложение лежит, Caddy отдаёт на него эту же страницу с 502).
  // Один цикл: зависший запрос обрывается через 4 с, «online» лишь ускоряет следующую проверку (ревью Codex 88).
  var timer = 0, busy = false;
  function check() {
    clearTimeout(timer);
    if (busy) return;
    busy = true;
    var ctl = window.AbortController ? new AbortController() : null;
    var stop = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    fetch("/api/health", { cache: "no-store", signal: ctl ? ctl.signal : undefined }).then(
      function (r) { done(); if (r.ok) location.reload(); else later(); },
      function () { done(); later(); }
    );
    function done() { clearTimeout(stop); busy = false; }
  }
  function later() { clearTimeout(timer); timer = setTimeout(check, 5000); }
  later();
  window.addEventListener("online", check);
})();
</script>
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  writeFileSync(DOWN_PAGE, downPageHtml());
  console.log(`Записано: ${DOWN_PAGE.pathname}`);
}
