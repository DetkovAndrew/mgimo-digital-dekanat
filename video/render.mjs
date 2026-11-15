// Рендер ролика: локальный сервер (сцена, снимки, шрифты Onest из assets/) + Chromium без окна.
//   node render.mjs stills 0.5,7,9,21,23.5,26,31.5,35     — кадры-проверки в out/stills/
//   node render.mjs video [--scale 0.5] [--from 0 --to 37] — out/dekanat.mp4 (H.264, 60 к/с)
//   node render.mjs video --music music.json                — по ролику и WAV на каждый вариант музыки
//   node render.mjs analyze                                  — темп, доли и громкость треков из music/
//   node render.mjs frames dekanat.mp4 1,9,26               — кадры из готового ролика в out/frames/
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FONTS = path.resolve(ROOT, "../assets/fonts/onest");
const OUT = path.join(ROOT, "out");
const TYPES = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".ttf": "font/ttf", ".mp4": "video/mp4" };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const [base, rel] = url.startsWith("/fonts/") ? [FONTS, url.slice(7)] : [ROOT, url === "/" ? "scene/index.html" : url.slice(1)];
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  const type = TYPES[path.extname(file)] ?? "application/octet-stream";
  const size = fs.statSync(file).size;
  // Range — чтобы <video> мог перематывать готовый ролик (режим frames).
  const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
  if (range) {
    const a = Number(range[1]);
    const b = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${a}-${b}/${size}`, "Accept-Ranges": "bytes", "Content-Length": b - a + 1 });
    fs.createReadStream(file, { start: a, end: b }).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const [mode, arg] = process.argv.slice(2);
const opt = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const scale = opt("scale", 1);

fs.mkdirSync(path.join(OUT, "stills"), { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage();
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.log("[page]", m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.exposeFunction("saveChunk", (name, b64, first) => {
    const file = name.endsWith(".png") ? path.join(OUT, "stills", name) : path.join(OUT, name);
    (first ? fs.writeFileSync : fs.appendFileSync)(file, Buffer.from(b64, "base64"));
  });
  await page.exposeFunction("progress", (done, total, ms) => {
    const per = done ? ms / done : 0;
    console.log(`кадр ${done}/${total}, ${per.toFixed(0)} мс/кадр, осталось ~${Math.round((per * (total - done)) / 60000)} мин`);
  });
  await page.goto(`http://127.0.0.1:${port}/?scale=${scale}`);
  await page.waitForFunction(() => window.ready === true);
  if (mode === "stills") {
    const times = (arg ?? "1").split(",").map(Number);
    await page.evaluate((times) => window.renderStills(times), times);
    console.log("кадры в", path.join(OUT, "stills"));
  } else if (mode === "video") {
    const name = process.argv.includes("--name") ? process.argv[process.argv.indexOf("--name") + 1] : "dekanat.mp4";
    const t0 = Date.now();
    // --music music.json — варианты звука (трек и привязка к таймлайну), на каждый свой MP4 и WAV.
    const musicArg = process.argv.includes("--music") ? process.argv[process.argv.indexOf("--music") + 1] : null;
    const variants = musicArg ? JSON.parse(fs.readFileSync(path.resolve(ROOT, musicArg), "utf8")) : [];
    await page.evaluate((o) => window.renderVideo(o), { from: opt("from", 0), to: opt("to", 37), name, bitrate: opt("bitrate", 24e6), variants });
    console.log(`готово: out/${name}, ${((Date.now() - t0) / 60000).toFixed(1)} мин`);
  } else if (mode === "analyze") {
    // Разбор треков из music/: темп, первая доля, громкость по секундам, тональный центр.
    const urls = fs.readdirSync(path.join(ROOT, "music")).filter((f) => f.endsWith(".mp3")).map((f) => `/music/${f}`);
    const res = await page.evaluate((urls) => window.analyzeTracks(urls), urls);
    fs.writeFileSync(path.join(OUT, "analysis.json"), JSON.stringify(res));
    for (const [url, a] of Object.entries(res)) {
      console.log(`${url}\n  ${a.duration} с, ${a.bpm} уд/мин (доля ${a.beat.toFixed(3)} с, первая ${a.firstBeat} с), тоны ${a.pitchClasses.join(" ")}`);
      console.log(`  дБ по секундам: ${a.rmsDb.join(" ")}`);
    }
  } else if (mode === "frames") {
    // Кадры из готового MP4 — проверка сжатия: node render.mjs frames dekanat.mp4 1,9,26
    const times = (process.argv[4] ?? "1").split(",").map(Number);
    fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });
    const shots = await page.evaluate(async ({ src, times }) => {
      const v = document.createElement("video");
      v.src = src;
      v.muted = true;
      await new Promise((r, e) => ((v.onloadeddata = r), (v.onerror = () => e(new Error("видео не открылось")))));
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const res = [{ duration: v.duration, w: v.videoWidth, h: v.videoHeight }];
      for (const t of times) {
        v.currentTime = t;
        await new Promise((r) => (v.onseeked = r));
        c.getContext("2d").drawImage(v, 0, 0);
        res.push(c.toDataURL("image/png").split(",")[1]);
      }
      return res;
    }, { src: `/out/${arg}`, times });
    console.log(JSON.stringify(shots[0]));
    shots.slice(1).forEach((b64, i) => fs.writeFileSync(path.join(OUT, "frames", `frame-${times[i].toFixed(2)}.png`), Buffer.from(b64, "base64")));
    console.log("кадры в", path.join(OUT, "frames"));
  } else throw new Error("режим: stills, video или frames");
} finally {
  await browser.close();
  server.close();
}
