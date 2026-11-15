// Снимки ранних версий кабинета для отчёта: коммит поднимается во временной копии (git worktree) со своей базой,
// этот скрипт снимает одни и те же экраны. Страницы, которых в версии ещё не было (404), пропускаются.
//   PW_A=… node history.mjs <метка> [адрес] [экраны через запятую]   → docs/submission/img/history/<метка>-<экран>.png
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [tag, base = "http://127.0.0.1:3010", list] = process.argv.slice(2);
if (!tag) throw new Error("укажите метку версии");
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../docs/submission/img/history");
fs.mkdirSync(OUT, { recursive: true });
const PAGES = {
  login: "/login",
  today: "/today",
  schedule: "/schedule",
  grades: "/grades",
  sport: "/sport",
  requests: "/requests",
  notifications: "/notifications",
  assistant: "/assistant",
  scheme: "/rooms/kronv?room=3310",
  ...Object.fromEntries((process.env.EXTRA ?? "").split(",").filter(Boolean).map((p) => p.split("="))),
};
const names = list ? list.split(",") : Object.keys(PAGES);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Europe/Moscow", colorScheme: process.env.SCHEME ?? "light" });
const r = await ctx.request.post(`${base}/api/auth/sign-in/username`, { data: { username: "alina.lebedeva", password: process.env.PW_A }, headers: { Origin: base } });
console.log("вход", r.status());
for (const name of names) {
  const page = await ctx.newPage();
  const res = await page.goto(base + PAGES[name], { waitUntil: "networkidle" });
  if (!res || res.status() >= 400 || (name !== "login" && page.url().includes("/login"))) {
    console.log("—", name, res?.status(), "нет в этой версии");
    await page.close();
    continue;
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  // Как высокий телефон: закреплённые элементы внизу, а не посреди длинной страницы.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 390, height: Math.min(h, Number(process.env.MAXH ?? 1500)) });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
  console.log("✓", name);
  await page.close();
}
await browser.close();
