// Скриншоты живого сайта для отчёта: телефон 390×844 и компьютер 1440×900, светлая и тёмная тема.
// Ничего не меняет на сайте: помощнице задаются вопросы (бронь только предлагается, не создаётся), заявки не подаются.
//   PW_A=… PW_T=… PW_STAFF=… node shots.mjs [имя,имя]   → docs/submission/img/live/*.png
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "https://university-dekanat.duckdns.org";
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../docs/submission/img/live");
const only = process.argv[2]?.split(",");
const want = (name) => !only || only.includes(name);
fs.mkdirSync(OUT, { recursive: true });

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };
const common = { locale: "ru-RU", timezoneId: "Europe/Moscow" };

const browser = await chromium.launch();
const errors = [];

async function context(device, scheme, user, password) {
  const ctx = await browser.newContext({ ...device, ...common, colorScheme: scheme });
  if (user) {
    if (!password) throw new Error(`нет пароля для ${user}`);
    const r = await ctx.request.post(`${BASE}/api/auth/sign-in/username`, { data: { username: user, password }, headers: { Origin: BASE } });
    if (!r.ok()) throw new Error(`вход ${user}: ${r.status()}`);
  }
  return ctx;
}

async function open(ctx, url) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${url}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(`${url}: ${m.text().slice(0, 160)}`));
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return page;
}

async function save(page, name, { full = false, maxHeight } = {}) {
  if (!want(name)) return;
  const file = path.join(OUT, `${name}.png`);
  if (!full) {
    await page.screenshot({ path: file });
  } else {
    // Длинный экран — как высокий телефон: окно растягиваем до высоты страницы, и закреплённые меню и кнопка
    // помощницы остаются внизу, а не висят посередине (так их рисует обычный fullPage).
    const size = page.viewportSize();
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: size.width, height: Math.min(h, maxHeight ?? h) });
    await page.waitForTimeout(400);
    await page.screenshot({ path: file });
    await page.setViewportSize(size);
  }
  console.log("✓", name);
}

async function shot(ctx, url, name, opts = {}) {
  if (!want(name) && !opts.always) return null;
  const page = await open(ctx, url);
  if (opts.before) await opts.before(page);
  await save(page, name, opts);
  if (!opts.keep) await page.close();
  return page;
}

const A = process.env.PW_A;
const T = process.env.PW_T;
const S = process.env.PW_STAFF;

// Телефон, светлая тема — Алина.
const pl = await context(PHONE, "light", "alina.lebedeva", A);
const anon = await context(PHONE, "light");
await shot(anon, "/login", "login");
await shot(pl, "/today", "today", { full: true, maxHeight: 1900 });
await shot(pl, "/schedule", "schedule", { full: true, maxHeight: 1900 });
const sch = await open(pl, "/schedule");
const lessonHref = await sch.locator('a[href^="/lessons/"]').first().getAttribute("href");
await sch.close();
await shot(pl, lessonHref, "lesson", { full: true, maxHeight: 1700 });
await shot(pl, "/schedule?view=month", "schedule-month", { full: true, maxHeight: 1700 });
await shot(pl, "/grades", "grades", { full: true, maxHeight: 1900 });
const gr = await open(pl, "/grades");
const courseHref = await gr.locator('a[href^="/courses/"]').first().getAttribute("href");
await gr.close();
await shot(pl, courseHref, "course", { full: true, maxHeight: 1700 });
await shot(pl, "/requests", "requests");
await shot(pl, "/requests/new", "requests-catalog", {
  before: async (p) => {
    await p.locator('input[type="search"]').first().fill("академ");
    await p.waitForTimeout(400);
  },
});
await shot(pl, "/requests/new?type=study_certificate", "request-form", { full: true, maxHeight: 1600 });
// Готовая справка и публичная страница проверки (ссылку берём кнопкой «Скопировать ссылку»).
let verifyUrl = null;
{
  const rq = await open(pl, "/requests");
  const ready = await rq.locator('a[href^="/requests/c"]').filter({ hasText: "Готова" }).first().getAttribute("href");
  await rq.close();
  await pl.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await open(pl, ready);
  await save(page, "certificate", { full: true, maxHeight: 1400 });
  await page.getByRole("button", { name: /Скопировать ссылку/ }).click();
  verifyUrl = await page.evaluate(() => navigator.clipboard.readText());
  await page.close();
}
if (verifyUrl && want("verify")) {
  const page = await anon.newPage();
  await page.goto(verifyUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await save(page, "verify");
  await page.close();
}
await shot(pl, "/notifications", "notifications");
await shot(pl, "/sport", "sport", { full: true, maxHeight: 1700 });
await shot(pl, "/services", "services", { full: true, maxHeight: 1800 });
await shot(pl, "/services/support", "support", { full: true, maxHeight: 1500 });
await shot(pl, "/services/print", "print", { full: true, maxHeight: 1500 });
await shot(pl, "/services/wifi", "wifi", { full: true, maxHeight: 1500 });
await shot(pl, "/map", "map", {
  before: async (p) => {
    await p.locator("#room-search").fill("1117");
    await p.waitForTimeout(400);
  },
});
await shot(pl, "/rooms/kronv?room=3310", "route", {
  before: async (p) => {
    await p.getByRole("link", { name: /^Маршрут/ }).first().click();
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(900);
    for (let i = 0; i < 2; i++) {
      await p.getByRole("button", { name: /Дальше/ }).first().click();
      await p.waitForTimeout(1600);
    }
    await p.evaluate(() => document.querySelector("svg[viewBox]")?.scrollIntoView({ block: "start" }));
    await p.evaluate(() => window.scrollBy(0, -70));
    await p.waitForTimeout(700);
  },
});
await shot(pl, "/rooms/find", "rooms-find", { full: true, maxHeight: 1500 });
await shot(pl, "/profile", "profile", { full: true, maxHeight: 2000 });
// Помощница: вопрос о расписании и просьба о брони (только карточка предложения, без брони).
for (const [name, q] of [
  ["assistant", "Что у меня завтра?"],
  ["assistant-booking", "Забронируй переговорную 1206 завтра с 15 до 16 для встречи по проекту"],
  ["assistant-docs", "Мне нужна справка для военкомата, что подготовить?"],
]) {
  if (!want(name)) continue;
  const page = await open(pl, "/today");
  await page.locator("[data-assistant-fab]").click();
  await page.waitForTimeout(900);
  await page.locator("dialog textarea").fill(q);
  await page.getByRole("button", { name: "Отправить вопрос" }).click();
  await page.waitForFunction(() => {
    const log = document.querySelector('[role="log"]');
    if (document.querySelector('dialog [role="alert"]')) throw new Error("ошибка помощника");
    return log && !log.querySelector('[role="status"]') && log.querySelectorAll(":scope > div").length >= 1;
  }, null, { timeout: 90_000 });
  await page.waitForTimeout(1200);
  await save(page, name);
  await page.close();
  await new Promise((r) => setTimeout(r, 7000)); // лимит помощника — 10 вопросов в минуту
}

// Безопасность: Алина открывает заявку Тимура по прямой ссылке → 404.
if (want("foreign-404")) {
  const tl = await context(PHONE, "light", "timur.orlov", T);
  const tp = await open(tl, "/requests");
  const foreign = await tp.locator('a[href^="/requests/c"]').first().getAttribute("href");
  await tl.close();
  await shot(pl, foreign, "foreign-404");
}

// Телефон, тёмная тема.
const pd = await context(PHONE, "dark", "alina.lebedeva", A);
await shot(pd, "/today", "today-dark", { full: true, maxHeight: 1900 });
await shot(pd, "/schedule", "schedule-dark");
await shot(pd, "/grades", "grades-dark");
await shot(pd, "/rooms/kronv?room=1117", "scheme-dark");

// Компьютер.
const dl = await context(DESK, "light", "alina.lebedeva", A);
await shot(dl, "/today", "desk-today");
await shot(dl, "/schedule?view=month", "desk-schedule");
await shot(dl, "/rooms/kronv?room=3310", "desk-scheme");
const dd = await context(DESK, "dark", "alina.lebedeva", A);
await shot(dd, "/today", "desk-today-dark");
if (want("staff") || want("staff-request")) {
  const st = await context(DESK, "light", "dekanat.fhb", S);
  await shot(st, "/staff", "staff");
  // Очередь «Новые» на демо-данных может быть пустой — карточку берём из «Все».
  const q = await open(st, "/staff?status=ALL");
  const href = await q.locator('a[href^="/staff/requests/"]').first().getAttribute("href");
  await q.close();
  await shot(st, href, "staff-request", { full: true, maxHeight: 1400 });
}
if (want("staff-schedule") || want("staff-lesson") || want("staff-announcements")) {
  const st = await context(DESK, "light", "dekanat.fhb", S);
  await shot(st, "/staff/schedule", "staff-schedule", { full: true, maxHeight: 1400 });
  // Первая пара списка: если деканат что-то менял, это пара из «Изменено деканатом» — с блоком «Вернуть как было».
  const q = await open(st, "/staff/schedule");
  const href = await q.locator('a[href^="/staff/schedule/"]').first().getAttribute("href");
  await q.close();
  await shot(st, href, "staff-lesson", { full: true, maxHeight: 1600 });
  await shot(st, "/staff/announcements", "staff-announcements", { full: true, maxHeight: 1400 });
}

console.log("ошибки консоли:", JSON.stringify(errors, null, 1));
await browser.close();
