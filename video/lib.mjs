// Общее для съёмки тизера (capture.mjs) и демонстрации (demo-capture.mjs): адрес кабинета, вход, ожидание отрисовки,
// прокрутка с дробными пикселями и CSS-анимации по времени ролика.

export const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
export const FPS = 60; // как у ролика: прокрутка без рывков
export const PHONE = { width: 390, height: 800 }; // + строка состояния 44 px рисуется в сцене → экран 390×844
export const DESK = { width: 1280, height: 800 }; // 16:10, как у ноутбука в сцене

export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Значение по ключам [время, y] с плавным разгоном и торможением между ключами. */
export function along(keys, t) {
  let y = keys[0][1];
  for (let k = 1; k < keys.length; k++) {
    const [t0, y0] = keys[k - 1];
    const [t1, y1] = keys[k];
    if (t >= t0 && t <= t1) y = y0 + (y1 - y0) * ease((t - t0) / (t1 - t0));
    else if (t > t1) y = y1;
  }
  return y;
}

export async function signIn(ctx, username, password) {
  if (!password) throw new Error(`нет пароля для ${username} в окружении`);
  const r = await ctx.request.post(`${BASE}/api/auth/sign-in/username`, { data: { username, password }, headers: { Origin: BASE } });
  if (!r.ok()) throw new Error(`вход ${username}: ${r.status()}`);
}

export async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

/** Прокрутка на y с дробной частью. Браузер прокручивает только на целые пиксели — на разгоне и торможении страница
 * стояла бы и прыгала. Целую часть — прокруткой, дробную — сдвигом <main> (шапка, меню и Инвиктия вне него).
 * Возвращает фактическое смещение после отрисовки. */
export function scrollTo(page, y) {
  return page.evaluate(
    (y) =>
      new Promise((r) => {
        window.scrollTo({ top: Math.floor(y), behavior: "instant" });
        const frac = Math.max(0, Math.min(0.999, y - window.scrollY));
        const main = document.querySelector("main");
        if (main) main.style.transform = frac ? `translateY(${-frac}px)` : "";
        requestAnimationFrame(() => requestAnimationFrame(() => r(window.scrollY + (main ? frac : 0))));
      }),
    y,
  );
}

/** CSS-анимации — по времени ролика, а не съёмки (≈150 мс на кадр ускоряли бы их в несколько раз). Бесконечные
 * (моргание, волосы, спиннер) идут от общего начала ms; разовые (появление окна, переходы цвета) — с момента, когда
 * их впервые увидела съёмка, с того места, где они были. */
export function stepAnimations(page, ms) {
  return page.evaluate((ms) => {
    const seen = (window.__videoAnims ??= new WeakMap());
    for (const a of document.getAnimations()) {
      // Переход страниц (View Transition, например после обновления данных) на паузе застыл бы снимками — смену
      // экранов рисует сцена, здесь он сразу доигрывается.
      if (a.effect?.pseudoElement?.startsWith("::view-transition")) {
        a.finish();
        continue;
      }
      a.pause();
      if (a.effect?.getComputedTiming().iterations === Infinity) {
        a.currentTime = ms;
        continue;
      }
      if (!seen.has(a)) seen.set(a, ms - (Number(a.currentTime) || 0));
      a.currentTime = ms - seen.get(a);
    }
    window.__videoTime?.(ms);
  }, ms);
}

/** Скрипт страницы (page.addInitScript): анимации на JS и SMIL — тоже по времени ролика. Без него ход Инвиктии по схеме
 * (`<animateMotion>`) и наезд камеры (requestAnimationFrame, 550 мс) шли по часам съёмки и в ролике пролетали.
 * performance.now и метка кадра rAF стоят между кадрами и идут вперёд из stepAnimations; сам rAF настоящий (scrollTo ждёт
 * отрисовку). SMIL: корневой <svg> ставится на паузу при запуске анимации, его время двигается с первого кадра, где его
 * увидела съёмка. До первого кадра часы идут как обычно. */
export function videoClock() {
  const real = performance.now.bind(performance);
  let shift = null;
  let now = null;
  performance.now = () => now ?? real();
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()));
  const root = (el) => {
    let svg = el.ownerSVGElement;
    while (svg?.ownerSVGElement) svg = svg.ownerSVGElement;
    return svg;
  };
  const begin = SVGAnimationElement.prototype.beginElement;
  SVGAnimationElement.prototype.beginElement = function () {
    root(this)?.pauseAnimations();
    return begin.call(this);
  };
  const svgs = new WeakMap();
  window.__videoTime = (ms) => {
    shift ??= real() - ms;
    now = ms + shift;
    for (const svg of document.querySelectorAll("svg")) {
      if (svg.ownerSVGElement || !svg.animationsPaused()) continue;
      if (!svgs.has(svg)) svgs.set(svg, ms / 1000 - svg.getCurrentTime());
      svg.setCurrentTime(ms / 1000 - svgs.get(svg));
    }
  };
}
