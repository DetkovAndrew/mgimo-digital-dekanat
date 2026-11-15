// Снимки кабинета для ролика: покадровые скриншоты телефона (прокрутка по кадрам — плавно и одинаково при каждом запуске)
// и экраны ноутбука для сцены с одобренной заявкой. Работает с локальным кабинетом (npm run dev в корне).
//
//   PW_A=… node capture.mjs phone        — экраны телефона (без записи в БД, кроме вопроса помощнице)
//   PW_A=… PW_STAFF=… node capture.mjs flow — заявка: Алина подаёт справку, деканат отмечает «Готово» (пишет в БД!)
//
// Пароли — только из окружения (как в seed), в файлы и журнал не попадают.
import fs from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = new URL("./captures/", import.meta.url).pathname;
const FPS = 60; // как у ролика: прокрутка без рывков
const PHONE = { width: 390, height: 800 }; // + строка состояния 44 px рисуется в сцене → экран 390×844
const DESK = { width: 1280, height: 800 }; // 16:10, как у ноутбука в сцене

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

async function signIn(ctx, username, password) {
  if (!password) throw new Error(`нет пароля для ${username} в окружении`);
  const r = await ctx.request.post(`${BASE}/api/auth/sign-in/username`, { data: { username, password }, headers: { Origin: BASE } });
  if (!r.ok()) throw new Error(`вход ${username}: ${r.status()}`);
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

/** Последовательность кадров: прокрутка по ключам [доля времени, y]. Пишет captures/phone/<name>/NNNN.jpg.
 * at — когда экран появляется в ролике: CSS-анимации (моргание, волосы) стоят на паузе, и на каждом кадре их время
 * выставляется по времени ролика. Иначе съёмка (≈150 мс на кадр) ускоряла бы их в ролике в несколько раз. */
async function sequence(page, name, seconds, keys, at = 0) {
  const dir = `${OUT}phone/${name}/`;
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const n = Math.round(seconds * FPS);
  const scrolls = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    let y = keys[0][1];
    for (let k = 1; k < keys.length; k++) {
      const [t0, y0] = keys[k - 1];
      const [t1, y1] = keys[k];
      if (t >= t0 && t <= t1) y = y0 + (y1 - y0) * ease((t - t0) / (t1 - t0));
      else if (t > t1) y = y1;
    }
    // Браузер прокручивает только на целые пиксели — на разгоне и торможении страница стояла бы и прыгала.
    // Целую часть — прокруткой, дробную — сдвигом <main> (шапка, меню и Инвиктия вне него); снимок — после отрисовки.
    const actual = await page.evaluate(
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
    scrolls.push([Math.round(y * 100) / 100, Math.round(actual * 100) / 100]);
    await page.evaluate((ms) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = ms;
      }
    }, (at + i / FPS) * 1000);
    await page.screenshot({ path: `${dir}${String(i).padStart(4, "0")}.jpg`, type: "jpeg", quality: 92 });
  }
  // Смещения по кадрам: при движении не должно быть повторов и откатов.
  const stalls = scrolls.filter(([want, got], i) => i > 0 && Math.abs(want - scrolls[i - 1][0]) > 0.02 && got === scrolls[i - 1][1]).length;
  await fs.writeFile(`${dir}scroll.json`, JSON.stringify(scrolls));
  console.log(`${name}: ${n} кадров, ${FPS} к/с, остановок при прокрутке: ${stalls}`);
  return n;
}

async function phoneScreens(browser, only) {
  const want = (name) => !only || only.split(",").includes(name);
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, colorScheme: "light", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  await signIn(ctx, "alina.lebedeva", process.env.PW_A);
  const page = await ctx.newPage();
  const open = async (path) => {
    await page.goto(BASE + path);
    // В кабинете кнопка помощницы прячется при прокрутке вниз; в ролике прокрутка почти всё время вниз,
    // и Инвиктия мигала бы — на съёмке держим её на месте.
    await page.addStyleTag({ content: "[data-assistant-fab]{opacity:1!important;translate:0 0!important}" });
    await settle(page);
  };
  // Частичная пересъёмка дополняет прежние метаданные.
  const meta = JSON.parse(await fs.readFile(`${OUT}phone/meta.json`, "utf8").catch(() => "{}"));
  meta.fps = meta.fps ?? {};

  if (want("today")) {
    await open("/today");
    meta.fps.today = FPS;
    meta.today = await sequence(page, "today", 5.5, [[0, 0], [0.15, 0], [0.85, 520], [1, 520]], 0.25);
  }
  if (want("schedule")) {
    await open("/schedule");
    meta.fps.schedule = FPS;
    meta.schedule = await sequence(page, "schedule", 2.2, [[0, 0], [0.2, 0], [1, 340]], 8);
  }
  if (want("grades")) {
    await open("/grades");
    meta.fps.grades = FPS;
    meta.grades = await sequence(page, "grades", 2.2, [[0, 0], [0.2, 0], [1, 300]], 10);
  }
  if (want("certificate")) {
    // Заявка со справкой: PDF и QR-проверка.
    await open("/requests");
    const ready = await page.locator('a[href^="/requests/c"]').filter({ hasText: "Готова" }).first().getAttribute("href");
    await open(ready);
    meta.fps.certificate = FPS;
    meta.certificate = await sequence(page, "certificate", 2.2, [[0, 0], [1, 0]], 12);
  }
  if (want("notifications")) {
    await open("/notifications");
    meta.fps.notifications = FPS;
    meta.notifications = await sequence(page, "notifications", 2.2, [[0, 0], [0.2, 0], [1, 380]], 14);
  }
  if (want("assistant")) {
    // Помощница: настоящий ответ GigaChat по кабинету Алины.
    await open("/today");
    await page.locator("[data-assistant-fab]").click();
    await page.waitForTimeout(900);
    await page.locator("dialog textarea").fill("Что у меня завтра?");
    await page.getByRole("button", { name: "Отправить вопрос" }).click();
    // Ответ пришёл: «Инвиктия смотрит в кабинет…» исчезло, в разговоре есть ответ; ошибка — стоп.
    await page.waitForFunction(() => {
      const log = document.querySelector('[role="log"]');
      if (document.querySelector('dialog [role="alert"]')) throw new Error("помощник ответил ошибкой");
      return log && !log.querySelector('[role="status"]') && log.querySelectorAll(":scope > div").length >= 1;
    }, null, { timeout: 90_000 });
    await page.waitForTimeout(1500);
    meta.fps.assistant = FPS;
    meta.assistant = await sequence(page, "assistant", 2.2, [[0, 0], [1, 0]], 16);
    await page.keyboard.press("Escape");
  }
  if (want("map")) {
    // Карта: схема корпуса с найденной аудиторией.
    await open("/rooms/kronv?room=1117");
    meta.fps.map = FPS;
    meta.map = await sequence(page, "map", 2.2, [[0, 60], [0.2, 60], [1, 230]], 18);
  }
  if (want("form")) {
    // Форма заявки, заполненная; координаты кнопки — для касания в сцене.
    await open("/requests/new?type=study_certificate");
    await page.locator("#destination").fill("По месту работы");
    await page.locator('input[name="format"]').first().check();
    await page.locator("#copies").fill("1");
    await page.evaluate(() => document.activeElement?.blur());
    meta.fps.form = FPS;
    meta.form = await sequence(page, "form", 3.2, [[0, 0], [0.25, 0], [0.75, 260], [1, 260]], 20);
    meta.submitButton = await page.getByRole("button", { name: "Отправить в деканат" }).boundingBox();
  }

  await fs.writeFile(`${OUT}phone/meta.json`, JSON.stringify(meta, null, 2));
  await ctx.close();
}

async function flow(browser) {
  await fs.mkdir(`${OUT}flow/`, { recursive: true });
  const meta = {};
  const phone = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, colorScheme: "light", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  await signIn(phone, "alina.lebedeva", process.env.PW_A);
  const p = await phone.newPage();

  // 1. Алина отправляет справку с телефона (та же форма, что в кадрах). REQUEST_ID — повтор съёмки без новой заявки.
  if (process.env.REQUEST_ID) {
    meta.requestId = process.env.REQUEST_ID;
    await p.goto(`${BASE}/requests/${meta.requestId}?created=1`);
  } else {
    await p.goto(`${BASE}/requests/new?type=study_certificate`);
    await settle(p);
    await p.locator("#destination").fill("По месту работы");
    await p.locator('input[name="format"]').first().check();
    await p.locator("#copies").fill("1");
    await p.getByRole("button", { name: "Отправить в деканат" }).click();
    await p.waitForURL(/\/requests\/c[a-z0-9]+(\?.*)?$/, { timeout: 30_000 });
    meta.requestId = new URL(p.url()).pathname.split("/").pop();
    console.log("подана заявка", meta.requestId);
  }
  await settle(p);
  await p.screenshot({ path: `${OUT}flow/phone-submitted.jpg`, type: "jpeg", quality: 92 });
  // Карточка заявки из списка — она «вылетает» из телефона.
  await p.goto(`${BASE}/requests`);
  await settle(p);
  await p.locator(`a[href="/requests/${meta.requestId}"]`).screenshot({ path: `${OUT}flow/card-phone.png` });
  await phone.close();

  // 2. Ноутбук до одобрения: список заявок; место карточки — для посадки.
  const desk = await browser.newContext({ viewport: DESK, deviceScaleFactor: 2, colorScheme: "light", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  await signIn(desk, "alina.lebedeva", process.env.PW_A);
  const d = await desk.newPage();
  await d.goto(`${BASE}/requests`);
  await settle(d);
  const row = d.locator(`a[href="/requests/${meta.requestId}"]`);
  meta.deskCard = await row.boundingBox();
  await row.screenshot({ path: `${OUT}flow/card-desk.png` });
  await d.screenshot({ path: `${OUT}flow/desk-list.png` });
  await row.evaluate((el) => (el.style.visibility = "hidden"));
  await d.screenshot({ path: `${OUT}flow/desk-list-gap.png` });

  // 3. Деканат: «Взять в работу» → «Отметить готовой» (выпуск справки с QR).
  const staff = await browser.newContext({ viewport: DESK, locale: "ru-RU", timezoneId: "Europe/Moscow" });
  await signIn(staff, "dekanat.fhb", process.env.PW_STAFF);
  const s = await staff.newPage();
  for (const action of ["Взять в работу", "Отметить готовой"]) {
    await s.goto(`${BASE}/staff/requests/${meta.requestId}`);
    await settle(s);
    await s.getByText(action, { exact: true }).click();
    await s.locator('button[type="submit"]').last().click();
    await s.waitForLoadState("networkidle");
    await s.waitForTimeout(800);
  }
  await staff.close();

  // 4. Ноутбук после: список (статус и колокольчик) и сама заявка — светлая и тёмная.
  await d.goto(`${BASE}/requests`);
  await settle(d);
  await d.screenshot({ path: `${OUT}flow/desk-list-ready.png` });
  await d.goto(`${BASE}/requests/${meta.requestId}`);
  await settle(d);
  await d.screenshot({ path: `${OUT}flow/desk-request-light.png` });
  await desk.close();
  const dark = await browser.newContext({ viewport: DESK, deviceScaleFactor: 2, colorScheme: "dark", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  await signIn(dark, "alina.lebedeva", process.env.PW_A);
  const k = await dark.newPage();
  await k.goto(`${BASE}/requests/${meta.requestId}`);
  await settle(k);
  await k.screenshot({ path: `${OUT}flow/desk-request-dark.png` });
  await dark.close();

  await fs.writeFile(`${OUT}flow/meta.json`, JSON.stringify(meta, null, 2));
  console.log("заявка", meta.requestId);
}

const what = process.argv[2];
const browser = await chromium.launch();
try {
  if (what === "phone") await phoneScreens(browser, process.argv[3]);
  else if (what === "flow") await flow(browser);
  else throw new Error("укажите phone или flow");
} finally {
  await browser.close();
}
