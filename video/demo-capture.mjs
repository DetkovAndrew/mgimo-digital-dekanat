// Съёмка полной демонстрации: сценарий студента по шагам. Телефон — кадры 60 к/с: прокрутка, касания и набор текста
// идут по времени плана, касания записываются в meta (сцена рисует их кругом). Ноутбук деканата — снимки целой
// страницы до и после каждого щелчка; курсор и прокрутку рисует сцена.
//
//   PW_A=… PW_STAFF=… node demo-capture.mjs [акты через запятую]   → captures/demo/<план>/, captures/demo/meta.json
//
// Акты: login, browse, request, staff, status, pushon, reschedule, moved, assistant, route, profile. Пишут в локальную БД:
// request — заявка на справку, staff — её обработка (выпуск справки), reschedule — перенос пары деканатом (после съёмки:
// npm run db:undo-staff), assistant — бронь переговорной. Пароли — только из окружения.
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { along, BASE, DESK, FPS, PHONE, scrollTo, settle, signIn, stepAnimations, videoClock } from "./lib.mjs";

const OUT = new URL("./captures/demo/", import.meta.url).pathname;
const meta = JSON.parse(await fs.readFile(`${OUT}meta.json`, "utf8").catch(() => '{"shots":{}}'));
// DEMO_FPS=6 — черновая съёмка для подбора прокрутки и касаний (в 10 раз быстрее).
const RATE = Number(process.env.DEMO_FPS ?? FPS);
// Подмена push для съёмки: разрешение «granted» по нажатию и подписка с ключами из примера RFC 8291 (не настоящие).
function fakePush() {
  let permission = "default";
  Object.defineProperty(Notification, "permission", { get: () => permission, configurable: true });
  Notification.requestPermission = async () => (permission = "granted");
  let sub = null;
  PushManager.prototype.getSubscription = async () => sub;
  PushManager.prototype.subscribe = async (opts) => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/demo-video-capture";
    const keys = { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" };
    const key = opts.applicationServerKey;
    sub = { endpoint, options: { applicationServerKey: key.buffer ?? key }, unsubscribe: async () => ((sub = null), true), toJSON: () => ({ endpoint, keys }) };
    return sub;
  };
}
const PIN = "[data-assistant-fab]{opacity:1!important;translate:0 0!important}";

/**
 * План телефона: n кадров, на каждом — шаги, чьё время пришло, прокрутка по ключам [с, y] и анимации по часам акта.
 * Шаги: { at, tap: локатор } — касание (координаты в meta; nav — нажать после плана и дождаться адреса, show — только
 * нарисовать); { at, type, dur } — набор текста в поле с фокусом по буквам; { at, run } — действие, съёмка его ждёт;
 * { at, point: [x, y] } — касание того, что рисует сцена (баннер уведомления), координаты холста без строки состояния.
 * banner: { at, until, title, body } — push-уведомление поверх страницы: его рисует сцена, в снимок страницы оно не попадает.
 */
async function shot(page, name, seconds, { scroll = [[0, 0]], steps = [], clock, banner }) {
  const dir = `${OUT}${name}/`;
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const n = Math.round(seconds * RATE);
  const todo = steps.map((s) => ({ ...s, typed: 0 })).sort((a, b) => a.at - b.at);
  const taps = [];
  let nav = null;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    for (const s of todo) {
      if (s.done || t < s.at) continue;
      if (s.type) {
        const k = Math.min(s.type.length, Math.ceil(((t - s.at) / s.dur) * s.type.length + 1e-9));
        if (k > s.typed) await page.keyboard.type(s.type.slice(s.typed, k));
        s.typed = k;
        s.done = k === s.type.length;
        continue;
      }
      s.done = true;
      if (s.tap) {
        const box = await s.tap.boundingBox();
        if (!box) throw new Error(`${name}: нет цели касания на ${s.at} с`);
        taps.push({ t: s.at, x: Math.round((box.x + box.width / 2) * 2), y: Math.round((box.y + box.height / 2) * 2), ...(s.reveal ? { reveal: true } : {}) });
        if (s.nav) nav = s;
        else if (!s.show) await s.tap.tap();
      }
      if (s.point) taps.push({ t: s.at, x: s.point[0], y: s.point[1] });
      if (s.run) await s.run(page);
    }
    await scrollTo(page, along(scroll, t));
    await stepAnimations(page, (clock.t + t) * 1000);
    await page.screenshot({ path: `${dir}${String(i).padStart(4, "0")}.jpg`, type: "jpeg", quality: 92 });
  }
  clock.t += seconds;
  meta.shots[name] = { device: "phone", frames: n, fps: RATE, taps, ...(banner ? { banner } : {}) };
  console.log(`${name}: ${n} кадров${taps.length ? `, касаний ${taps.length}` : ""}`);
  if (nav) {
    await Promise.all([page.waitForURL(nav.nav, { timeout: 30_000 }), nav.tap.tap()]);
    await ready(page);
  }
}

/** Неподвижный экран (PDF): один кадр, сцена держит его seconds. */
async function still(page, name, seconds) {
  const dir = `${OUT}${name}/`;
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}0000.jpg`, type: "jpeg", quality: 92 });
  meta.shots[name] = { device: "phone", frames: 1, fps: 1 / seconds, still: true, taps: [] };
  console.log(`${name}: неподвижный, ${seconds} с`);
}

async function ready(page) {
  if (!(await page.locator("#demo-pin").count())) await page.addStyleTag({ content: PIN }).then((h) => h.evaluate((el) => (el.id = "demo-pin")));
  await settle(page);
}

async function phone(browser, { session = true } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  if (session) await signIn(ctx, "alina.lebedeva", process.env.PW_A);
  const page = await ctx.newPage();
  const open = async (path) => {
    await page.goto(BASE + path);
    await ready(page);
  };
  return { ctx, page, open, clock: { t: 0 } };
}

/**
 * Ноутбук деканата: снимки всей страницы до и после каждого щелчка; курсор и прокрутку рисует сцена.
 * run({ page, snap, click }) — сценарий; click(at, локатор, ожидание) — курсор к центру цели к моменту at, снимок «после».
 */
async function desk(browser, name, run) {
  const ctx = await browser.newContext({ viewport: DESK, deviceScaleFactor: 2, colorScheme: "light", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  await signIn(ctx, "dekanat.fhb", process.env.PW_STAFF);
  const page = await ctx.newPage();
  const dir = `${OUT}${name}/`;
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const stills = [];
  const cursor = [];
  // Снимок всей страницы: прокрутку сцена делает сама (шапка деканата не закреплена — так честно).
  const snap = async (t) => {
    const file = `${String(stills.length).padStart(2, "0")}.png`;
    await page.screenshot({ path: dir + file, fullPage: true });
    stills.push({ t, file, h: await page.evaluate(() => document.documentElement.scrollHeight) });
  };
  const click = async (at, loc, wait) => {
    const box = await loc.boundingBox();
    const y = await page.evaluate(() => window.scrollY);
    cursor.push({ t: at, x: Math.round(box.x + box.width / 2), y: Math.round(box.y + y + box.height / 2), click: true });
    await loc.click();
    if (wait) await wait();
    await settle(page);
    await page.mouse.move(0, 0); // без подсветки наведения на снимке
    await page.waitForTimeout(300);
    await snap(at + 0.12);
  };
  const extra = await run({ page, snap, click });
  await ctx.close();
  console.log(`${name}:`, stills.length, "снимков");
  return { stills, cursor, ...extra };
}

const tab = (page, name) => page.locator("nav").getByRole("link", { name, exact: true }).filter({ visible: true });

const ACTS = {
  // 1. Вход: логин и пароль набираются по буквам, «Войти» — настоящий вход.
  async login(browser) {
    const { ctx, page, open, clock } = await phone(browser, { session: false });
    await open("/login");
    await shot(page, "login", 5.4, {
      clock,
      steps: [
        { at: 0.7, tap: page.locator('input[name="username"]') },
        { at: 1.0, type: "alina.lebedeva", dur: 1.5 },
        { at: 2.9, tap: page.locator("#password") },
        { at: 3.2, type: process.env.PW_A, dur: 1.1 },
        { at: 4.9, tap: page.getByRole("button", { name: "Войти" }), nav: /\/today/ },
      ],
    });
    await ctx.close();
  },

  // 2. «Сегодня» → расписание → учёба → дисциплина.
  async browse(browser) {
    const { ctx, page, open, clock } = await phone(browser);
    await open("/today");
    await shot(page, "today", 8, {
      clock,
      scroll: [[0, 0], [1.6, 0], [5.0, 640], [6.6, 640], [7.4, 640]],
      steps: [{ at: 7.5, tap: tab(page, "Расписание"), nav: /\/schedule/ }],
    });
    await shot(page, "schedule", 8, {
      clock,
      scroll: [[0, 0], [1.4, 0], [4.6, 520], [7, 520]],
      steps: [{ at: 7.5, tap: tab(page, "Учёба"), nav: /\/grades/ }],
    });
    await shot(page, "grades", 7, {
      clock,
      scroll: [[0, 0], [1.4, 0], [4.2, 420], [7, 420]],
      steps: [{ at: 6.5, tap: page.locator('a[href^="/courses/"]').filter({ hasText: "33,5" }), nav: /\/courses\// }],
    });
    await shot(page, "course", 6, {
      clock,
      scroll: [[0, 0], [1.2, 0], [4.0, 420], [6, 420]],
      steps: [{ at: 5.5, tap: tab(page, "Заявки"), show: true }],
    });
    await ctx.close();
  },

  // 3. Заявка на справку об обучении: каталог (вкладка «Заявки»), поиск, форма, отправка. Пишет в БД.
  async request(browser) {
    const { ctx, page, open, clock } = await phone(browser);
    await open("/requests");
    await shot(page, "requests", 5.6, {
      clock,
      steps: [
        { at: 1.4, tap: page.locator('input[type="search"]') },
        { at: 1.7, type: "справка", dur: 0.9 },
        { at: 5.1, tap: page.locator('a[href="/requests/new?type=study_certificate"]'), nav: /type=study_certificate/ },
      ],
    });
    await shot(page, "form", 9.4, {
      clock,
      scroll: [[0, 0], [0.9, 0], [2.0, 250], [5.0, 250], [6.2, 470], [9.4, 470]],
      steps: [
        { at: 2.4, tap: page.locator("#destination") },
        { at: 2.7, type: "По месту работы", dur: 1.4 },
        { at: 4.5, tap: page.locator('label:has(input[name="format"])').first() },
        { at: 6.8, tap: page.locator("#copies") },
        { at: 7.1, type: "1", dur: 0.1 },
        { at: 7.6, run: (p) => p.evaluate(() => document.activeElement?.blur()) },
        { at: 8.9, tap: page.getByRole("button", { name: "Отправить в деканат" }), nav: /\/requests\/c[a-z0-9]+/ },
      ],
    });
    meta.requestId = new URL(page.url()).pathname.split("/").pop();
    console.log("подана заявка", meta.requestId);
    await shot(page, "submitted", 4.4, { clock });
    await ctx.close();
  },

  // 4. Деканат на ноутбуке: список → заявка → «Взять в работу» → «Отметить готовой». Пишет в БД.
  async staff(browser) {
    if (!meta.requestId) throw new Error("сначала акт request");
    const shot = await desk(browser, "staff", async ({ page, snap, click }) => {
      await page.goto(`${BASE}/staff`);
      await settle(page);
      await snap(0);
      const row = page.locator(`a[href="/staff/requests/${meta.requestId}"]`);
      const rowBox = await row.boundingBox();
      await click(1.6, row, () => page.waitForURL(/\/staff\/requests\//));
      const apply = () => page.getByRole("button", { name: /Применить/ });
      const saved = (status) => () => page.locator("h1").locator("..").getByText(status).first().waitFor({ timeout: 15_000 });
      await click(4.4, page.getByText("Взять в работу", { exact: true }));
      await click(5.4, apply(), saved("В работе"));
      await click(6.9, page.getByText("Отметить готовой", { exact: true }));
      await click(7.9, apply(), saved("Готова"));
      return { row: { x: rowBox.x, y: rowBox.y, width: rowBox.width, height: rowBox.height } };
    });
    meta.shots.staff = {
      device: "laptop",
      seconds: 10.4,
      ...shot,
      start: { x: 1010, y: 620 },
      // Прокрутка страницы заявки: вниз к «Обработке» и наверх — к новому статусу.
      scroll: [[0, 0], [2.3, 0], [3.5, 470], [5.7, 470], [6.4, 620], [8.6, 620], [9.7, 0]],
    };
  },

  // 5. Студент видит результат: уведомление → заявка «Готова» → PDF → страница проверки по QR.
  async status(browser) {
    if (!meta.requestId) throw new Error("сначала акт request");
    const { ctx, page, open, clock } = await phone(browser);
    await open("/today");
    await shot(page, "bell", 3, { clock, steps: [{ at: 2.5, tap: page.locator('a[href="/notifications"]').filter({ visible: true }).first(), nav: /\/notifications/ }] });
    await shot(page, "notifications", 4.4, { clock, steps: [{ at: 3.9, tap: page.locator(`a[href="/requests/${meta.requestId}"]`).first(), nav: /\/requests\/c/ }] });
    await shot(page, "ready", 6.6, {
      clock,
      scroll: [[0, 0], [1.6, 0], [3.4, 300], [6.6, 300]],
      steps: [{ at: 6.1, tap: page.getByRole("link", { name: /Скачать PDF/ }), show: true }],
    });
    // PDF справки: страница → PNG (PyMuPDF), QR-код читаем — это адрес страницы проверки — и размываем на кадре.
    const pdf = await ctx.request.get(`${BASE}/api/requests/${meta.requestId}/document`);
    if (!pdf.ok()) throw new Error(`PDF: ${pdf.status()}`);
    await fs.writeFile(`${OUT}certificate.pdf`, await pdf.body());
    const info = JSON.parse(execFileSync("python3", [new URL("./pdf-still.py", import.meta.url).pathname, `${OUT}certificate.pdf`, `${OUT}certificate.png`], { encoding: "utf8" }));
    const verifyPath = new URL(info.url).pathname;
    await page.goto("about:blank");
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;background:#2b2f3a;font:600 15px system-ui;color:#fff">
      <div style="height:52px;display:flex;align-items:center;justify-content:center;background:#1c1f27">Справка ${info.number}.pdf</div>
      <img src="data:image/png;base64,${(await fs.readFile(`${OUT}certificate.png`)).toString("base64")}" style="display:block;width:362px;margin:14px auto;box-shadow:0 4px 18px rgba(0,0,0,.35)">
      </body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await still(page, "pdf", 4.6);
    // Работодатель открывает ссылку из QR — та же страница проверки, без входа.
    const guest = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light", locale: "ru-RU", timezoneId: "Europe/Moscow" });
    const g = await guest.newPage();
    await g.goto(BASE + verifyPath);
    await settle(g);
    await shot(g, "verify", 5.4, { clock, scroll: [[0, 0], [1.8, 0], [3.6, 200], [5.4, 200]] });
    await guest.close();
    await ctx.close();
  },

  // 5. Уведомления на телефон: «Включить» в профиле. У браузера без экрана нет службы push — разрешение и подписку
  // подменяем (адрес с ненастоящим токеном: сервер сохранит его в локальной базе, служба ответит 404, и подписка удалится).
  async pushon(browser) {
    const { ctx, page, open, clock } = await phone(browser);
    await page.addInitScript(fakePush);
    await open("/today");
    await shot(page, "today-push", 2.4, { clock, steps: [{ at: 1.9, tap: page.locator('a[href="/profile"]').filter({ visible: true }).first(), nav: /\/profile/ }] });
    const block = page.getByRole("heading", { name: "Уведомления на телефон" });
    const y = Math.max(0, Math.round((await block.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)) - 260));
    await shot(page, "push-on", 6.4, {
      clock,
      scroll: [[0, 0], [0.8, 0], [2.4, y], [6.4, y]],
      steps: [{ at: 3.4, tap: page.getByRole("button", { name: "Включить" }) }],
    });
    if (!(await page.getByText("Включены на этом устройстве").count())) throw new Error("push-on: уведомления не включились");
    await ctx.close();
  },

  // 5а. Деканат на ноутбуке переносит онлайн-семинар группы Алины очно в переговорную. Пишет в БД (откат —
  // npm run db:undo-staff). Пара — ближайшая онлайн-«Философия» группы H3301 в списке расписания факультета (уведомление ведёт на её неделю).
  async reschedule(browser) {
    const shot = await desk(browser, "reschedule", async ({ page, snap, click }) => {
      await page.goto(`${BASE}/staff/schedule?group=H3301`);
      await settle(page);
      await snap(0);
      const row = page.locator('a[href^="/staff/schedule/"]').filter({ hasText: "онлайн" }).filter({ hasText: "Философия" }).first();
      await click(1.6, row, () => page.waitForURL(/\/staff\/schedule\/[^/?]+$/));
      meta.movedLessonId = new URL(page.url()).pathname.split("/").pop();
      // Форма — на экран: корпус примерно на трети высоты.
      const select = page.locator('select[name="building"]');
      const form = Math.round((await select.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)) - 260);
      await page.evaluate((y) => window.scrollTo(0, y), form);
      await click(3.4, select);
      await select.selectOption("kronv");
      await snap(3.8);
      const room = page.locator('input[name="room"]');
      await click(4.6, room);
      await room.fill("1206");
      await snap(5.2);
      const reason = page.locator('textarea[name="reason"]');
      await click(6.0, reason);
      await reason.fill("Семинар пройдёт очно: обсуждение эссе в переговорной");
      await snap(6.9);
      await click(8.2, page.getByRole("button", { name: /Перенести и уведомить/ }), () => page.waitForURL(/updated=1/));
      return { form };
    });
    meta.shots.reschedule = {
      device: "laptop",
      seconds: 11.6,
      ...shot,
      start: { x: 1010, y: 620 },
      // Вниз к форме, после сохранения — наверх: «Сохранено», «Изменено» и «Вернуть как было».
      scroll: [[0, 0], [2.3, 0], [3.3, shot.form], [8.5, shot.form], [9.4, 0], [11.6, 0]],
    };
  },

  // 5б. Алина: push о переносе → расписание недели → пара «Изменено», новая аудитория и путь до неё.
  async moved(browser) {
    if (!meta.movedLessonId) throw new Error("сначала акт reschedule");
    const { ctx, page, open, clock } = await phone(browser);
    // Куда ведёт уведомление о переносе — та же ссылка, что у push (неделя пары).
    const list = await ctx.newPage();
    await list.goto(`${BASE}/notifications`);
    const href = await list.locator('main a[href^="/schedule"]').first().getAttribute("href");
    await list.close();
    await open("/today");
    // Push о переносе: баннер сверху (текст — как на экране блокировки), касание по нему открывает неделю пары.
    await shot(page, "moved-push", 4.8, {
      clock,
      banner: { at: 0.7, until: 3.9, title: "Изменение в расписании", body: "Откройте кабинет University, чтобы посмотреть." },
      steps: [{ at: 3.5, point: [390, 100] }],
    });
    await page.goto(BASE + href);
    await ready(page);
    const card = page.locator(`a[href="/lessons/${meta.movedLessonId}"]`).first();
    const y = Math.max(0, Math.round((await card.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)) - 300));
    await shot(page, "moved-schedule", 6.4, {
      clock,
      scroll: [[0, 0], [1.2, 0], [3.6, y], [6.4, y]],
      steps: [{ at: 5.9, tap: card, nav: /\/lessons\// }],
    });
    // Причина и новая аудитория с кнопками маршрута остаются на экране.
    await shot(page, "moved-lesson", 7, { clock, scroll: [[0, 0], [2.4, 0], [4.0, 170], [7, 170]] });
    await ctx.close();
  },

  // 6. Инвиктия: вопрос, ответ GigaChat с карточкой брони, «Забронировать» — настоящая бронь. Пишет в БД.
  async assistant(browser) {
    const { ctx, page, open, clock } = await phone(browser);
    // Ответ модели держим, пока на съёмке не пройдёт «думает…» — иначе он пришёл бы на случайном кадре.
    let release;
    const gate = new Promise((r) => (release = r));
    await page.route("**/api/assistant", async (route) => {
      const res = await route.fetch();
      const body = await res.body();
      await gate;
      await route.fulfill({ response: res, body });
    });
    await open("/today");
    // По нажатию Инвиктия 380 мс весело жмурится, потом открывается окно. Таймер шёл бы по часам съёмки (≈3 кадра) —
    // перехватываем его и запускаем по времени ролика.
    await page.evaluate(() => {
      const plain = window.setTimeout;
      window.setTimeout = (fn, ms, ...rest) => (ms === 380 ? ((window.__joy = fn), 0) : plain(fn, ms, ...rest));
    });
    const question = "Забронируй переговорную в понедельник с 15 до 16 для встречи по проекту";
    await shot(page, "ask", 7.4, {
      clock,
      steps: [
        { at: 0.8, tap: page.locator("[data-assistant-fab]") },
        { at: 1.18, run: (p) => p.evaluate(() => window.__joy()) },
        { at: 1.25, run: (p) => p.locator("dialog[open]").waitFor() },
        { at: 1.9, tap: page.locator("dialog textarea") },
        { at: 2.2, type: question, dur: 2.6 },
        { at: 5.3, tap: page.getByRole("button", { name: "Отправить вопрос" }) },
      ],
    });
    release();
    await page.waitForFunction(() => {
      if (document.querySelector('dialog [role="alert"]')) throw new Error("помощник ответил ошибкой");
      const log = document.querySelector('[role="log"]');
      return log && !log.querySelector('[role="status"]') && log.textContent.includes("Забронировать");
    }, null, { timeout: 120_000 });
    await page.waitForTimeout(600);
    await shot(page, "answer", 8.4, {
      clock,
      steps: [
        { at: 4.6, tap: page.getByRole("button", { name: "Забронировать" }) },
        { at: 4.9, run: (p) => p.getByText("Забронировано.").waitFor({ timeout: 30_000 }) },
      ],
    });
    await ctx.close();
  },

  // 7. Как пройти к аудитории следующей пары: схема корпуса по шагам. Ход Инвиктии и камера — по часам ролика (videoClock),
  // «Дальше» — через секунду после того, как она дошла, как на сайте (шаги 1 и 3 — по 1.4 с, шаг 2 по коридору — 5.7 с).
  // ROUTE_HREF=/rooms/… — переснять только схему (план today-route прежний), если сейчас у следующей пары нет «Как пройти».
  async route(browser) {
    const { ctx, page, open, clock } = await phone(browser);
    await page.addInitScript(videoClock);
    if (process.env.ROUTE_HREF) await open(process.env.ROUTE_HREF);
    else {
      await open("/today");
      await shot(page, "today-route", 2.8, { clock, steps: [{ at: 2.3, tap: page.getByRole("link", { name: /Как пройти/ }).first(), nav: /route|rooms|map/ }] });
    }
    const next = () => page.getByRole("button", { name: /Дальше/ }).first();
    await shot(page, "route", 13.8, {
      clock,
      scroll: [[0, 0], [0.7, 0], [1.9, 300], [13.8, 300]],
      steps: [
        { at: 2.6, tap: next() },
        { at: 9.4, tap: next() },
        { at: 11.9, tap: next() },
      ],
    });
    await ctx.close();
  },

  // 8. Профиль и тёмная тема.
  async profile(browser) {
    const { ctx, page, open, clock } = await phone(browser);
    await open("/today");
    await shot(page, "today-profile", 2.4, { clock, steps: [{ at: 1.9, tap: page.locator('a[href="/profile"]').filter({ visible: true }).first(), nav: /\/profile/ }] });
    const theme = page.locator('label:has(input[name="theme"][value="dark"])');
    const y = Math.max(0, Math.round((await theme.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)) - 520));
    await shot(page, "profile", 11, {
      clock,
      scroll: [[0, 0], [2.4, 0], [4.6, y], [8.6, y], [10.4, 0]],
      steps: [{ at: 5.6, tap: theme, reveal: true }],
    });
    await ctx.close();
  },
};

const only = process.argv[2]?.split(",") ?? Object.keys(ACTS);
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const act of only) {
    if (!ACTS[act]) throw new Error(`нет акта ${act}`);
    await ACTS[act](browser);
    await fs.writeFile(`${OUT}meta.json`, JSON.stringify(meta, null, 2));
  }
} finally {
  await browser.close();
}
