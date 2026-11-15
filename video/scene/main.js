// Ролик «Цифровой деканат»: таймлайн, камера, рендер кадров и кодирование H.264 (WebCodecs) в MP4 (mp4-muxer).
// Кадр t → состояние сцены считается заново, без накопления: любой кадр можно отрисовать отдельно (?stills=…).
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { analyze, decode, encodeOpus, mixScore, SR, toWav } from "./audio.js";
import { LAPTOP, laptopScreenPoint, makeCard, makeLaptop, makePhone, softShadow } from "./models.js";
import { clamp01, drawBackground, drawBrand, drawCaption, drawEndCard, drawFade, drawFlash, smooth } from "./overlay.js";
import { frameUrl, image, LaptopScreen, PhoneScreen } from "./screens.js";

const FPS = 60; // прокрутка текста при 30 к/с заметно дёргается
const DURATION = 37;
const q = new URLSearchParams(location.search);
const SCALE = Number(q.get("scale") ?? 1);
const W = Math.round((1920 * SCALE) / 2) * 2;
const H = Math.round((1080 * SCALE) / 2) * 2;

// Таймлайн, секунды.
const T = {
  todayAt: 0.25,
  features: 8.0,
  featureLen: 2.0,
  form: 20.0,
  tap: 22.45,
  submitted: 22.75,
  lift: 22.95,
  cut: 24.2,
  land: 25.45,
  approve: 26.05,
  toRequest: 27.0,
  pullBack: 28.6,
  dim: [30.2, 31.2],
  reveal: [31.25, 32.05],
  end: 33.4,
};
const FEATURES = [
  { seq: "schedule", title: "Расписание", sub: "Неделя, аудитории и переносы" },
  { seq: "grades", title: "Успеваемость", sub: "Баллы, зачёты и сессия" },
  { seq: "certificate", title: "Справки с QR-кодом", sub: "PDF, который проверит работодатель" },
  { seq: "notifications", title: "Уведомления", sub: "Деканат, сроки и изменения" },
  { seq: "assistant", title: "Помощница Инвиктия", sub: "Отвечает по вашему кабинету" },
  { seq: "map", title: "Карта кампуса", sub: "Найти аудиторию и забронировать" },
];
const SLIDE = 0.42;

/** Гладкая кривая через ключи [время, [значения]]: касательные по соседям, на краях — плавный старт и остановка. */
function track(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (keys[i + 1][0] < t) i++;
  const [t0, p0] = keys[i];
  const [t1, p1] = keys[i + 1];
  const dt = t1 - t0;
  const u = (t - t0) / dt;
  const tan = (k) => {
    if (k <= 0 || k >= n - 1) return null;
    const [ta, pa] = keys[k - 1];
    const [tb, pb] = keys[k + 1];
    return pa.map((v, j) => (pb[j] - v) / (tb - ta));
  };
  const m0 = tan(i);
  const m1 = tan(i + 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  const h01 = -2 * u ** 3 + 3 * u ** 2;
  const h11 = u ** 3 - u ** 2;
  return p0.map((v, j) => h00 * v + h10 * dt * (m0 ? m0[j] : 0) + h01 * p1[j] + h11 * dt * (m1 ? m1[j] : 0));
}

// Камера: [позиция x y z, цель x y z, угол обзора].
const PHONE_CAM = [
  [0, [0, 0.06, 5.0, 0, 0, 0, 30]],
  [6.0, [0, 0.04, 4.5, 0, 0, 0, 30]],
  [8.0, [-1.55, 0.38, 3.7, -0.66, 0.0, 0, 30]],
  [20.0, [-1.4, 0.32, 3.6, -0.62, 0.02, 0, 30]],
  [22.9, [-1.26, 0.3, 3.7, -0.56, 0.02, 0, 30]],
  [T.cut, [-0.95, 0.22, 3.2, -0.38, 0.02, 0, 30]],
];
const PHONE_YAW = [
  [0, [0]],
  [6.0, [0.03]],
  [8.0, [-0.26]],
  [20.0, [-0.24]],
  [22.8, [-0.16]],
  [T.cut, [-0.08]],
];
const LAPTOP_CAM = [
  // Крупно экран — посадка карточки и одобрение читаются; затем отъезд, ноутбук целиком и надпись.
  [T.cut, [0.02, 1.32, 2.75, 0.14, 0.99, -1.2, 30]],
  [T.toRequest, [0.08, 1.27, 2.45, 0.12, 0.99, -1.2, 30]],
  [T.pullBack, [0.42, 1.8, 5.3, 0.04, 1.02, -0.55, 30]],
  [T.end, [0.66, 1.74, 5.05, 0.05, 1.02, -0.58, 30]],
  [DURATION, [0.74, 1.72, 4.95, 0.05, 1.02, -0.58, 30]],
];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
RectAreaLightUniformsLib.init();
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 100);
const out = document.createElement("canvas");
out.width = W;
out.height = H;
const g = out.getContext("2d");

// Сцена 1: телефон.
const phoneScene = new THREE.Scene();
phoneScene.environment = envMap;
const phoneScreen = new PhoneScreen();
const phone = makePhone(phoneScreen.texture);
phoneScene.add(phone.group);
const phoneShadow = softShadow(1.5, 0.55, 0.3);
phoneShadow.position.y = -1.22;
phoneScene.add(phoneShadow);
const key1 = new THREE.DirectionalLight(0xffffff, 1.4);
key1.position.set(-3, 4, 5);
phoneScene.add(key1);
const rim1 = new THREE.DirectionalLight(0xc9d0ff, 1.1);
rim1.position.set(3, 1.5, -3);
phoneScene.add(rim1);

// Сцена 2: ноутбук.
const laptopScene = new THREE.Scene();
laptopScene.environment = envMap;
const laptopScreen = new LaptopScreen();
const laptop = makeLaptop(laptopScreen.texture);
laptopScene.add(laptop.group);
const laptopShadow = softShadow(4.6, 3.3, 0.34);
laptopShadow.position.y = 0.001;
laptopScene.add(laptopShadow);
const key2 = new THREE.DirectionalLight(0xffffff, 1.5);
key2.position.set(-3, 5, 4);
laptopScene.add(key2);
// Свет экрана ночью: прямоугольник на месте экрана, светит вперёд.
const glow = new THREE.RectAreaLight(0xbfc8ff, 0, LAPTOP.screenW, LAPTOP.screenH);
glow.position.set(0, laptop.screenY, laptop.front + 0.02);
laptop.lid.add(glow);
glow.lookAt(laptop.lid.localToWorld(new THREE.Vector3(0, laptop.screenY, 3)));

let assets;
let phoneCard;
let deskCard;

async function load() {
  await Promise.all([
    new FontFace("Onest", "url(/fonts/Onest-Regular.ttf)", { weight: "400" }).load(),
    new FontFace("Onest", "url(/fonts/Onest-SemiBold.ttf)", { weight: "600" }).load(),
  ]).then((faces) => faces.forEach((f) => document.fonts.add(f)));
  const [phoneMeta, flowMeta] = await Promise.all([fetch("/captures/phone/meta.json").then((r) => r.json()), fetch("/captures/flow/meta.json").then((r) => r.json())]);
  const f = (name) => image(`/captures/flow/${name}`);
  const [submitted, cardPhone, cardDesk, gap, list, ready, reqLight, reqDark] = await Promise.all([
    f("phone-submitted.jpg"),
    f("card-phone.png"),
    f("card-desk.png"),
    f("desk-list-gap.png"),
    f("desk-list.png"),
    f("desk-list-ready.png"),
    f("desk-request-light.png"),
    f("desk-request-dark.png"),
  ]);
  assets = { phoneMeta, flowMeta, submitted, desk: { gap, list, ready, reqLight, reqDark } };
  phoneCard = makeCard(cardPhone, cardPhone.width / 2, cardPhone.height / 2);
  deskCard = makeCard(cardDesk, cardDesk.width / 2, cardDesk.height / 2);
  phoneScene.add(phoneCard);
  laptopScene.add(deskCard);
}

const PHONE_ITEMS = () => [
  { at: 0, seq: "today", start: T.todayAt },
  ...FEATURES.map((ft, i) => ({ at: T.features + i * T.featureLen, seq: ft.seq, start: T.features + i * T.featureLen })),
  { at: T.form, seq: "form", start: T.form },
  { at: T.submitted, still: true },
];

async function phoneImage(item, t) {
  if (item.still) return assets.submitted;
  const n = assets.phoneMeta[item.seq];
  const fps = assets.phoneMeta.fps?.[item.seq] ?? 30;
  // round, не floor: t = кадр/FPS в дробях даёт 59.9999… — floor повторял бы кадр и пропускал следующий.
  const i = Math.max(0, Math.min(n - 1, Math.round((t - item.start) * fps)));
  return image(frameUrl(item.seq, i));
}

async function updatePhoneScreen(t) {
  const items = PHONE_ITEMS();
  let k = 0;
  while (k + 1 < items.length && items[k + 1].at <= t) k++;
  const cur = await phoneImage(items[k], t);
  const slide = k > 0 ? clamp01((t - items[k].at) / SLIDE) : 1;
  const prev = slide < 1 ? await phoneImage(items[k - 1], t) : null;
  const b = assets.phoneMeta.submitButton;
  const tapP = (t - T.tap) / 0.45;
  phoneScreen.draw({ cur, prev, slide, tap: { x: (b.x + b.width / 2) * 2, y: (b.y + b.height / 2) * 2 + 88, p: tapP } });
}

function setCamera(keys, t) {
  const [px, py, pz, tx, ty, tz, fov] = track(keys, t);
  camera.position.set(px, py, pz);
  camera.lookAt(tx, ty, tz);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

/** Поза карточки перед камерой: закрывает кадр целиком. */
function poseInFront(dist, aspect) {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const pos = camera.position.clone().addScaledVector(fwd, dist);
  const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const h = Math.max(visH * 1.25, (visH * (W / H) * 1.1) / aspect);
  return { pos, quat: camera.quaternion.clone(), w: h * aspect, h };
}

function placeCard(card, from, to, e, arc, spin, opacity) {
  card.position.lerpVectors(from.pos, to.pos, e);
  card.position.y += arc;
  card.quaternion.slerpQuaternions(from.quat, to.quat, smooth(0, 1, e));
  card.rotateZ(spin);
  const w = THREE.MathUtils.lerp(from.w, to.w, e);
  const h = THREE.MathUtils.lerp(from.h, to.h, e);
  card.scale.set(w, h, 1);
  card.material.opacity = opacity;
  card.visible = opacity > 0;
}

function laptopState(t) {
  const d = assets.desk;
  const box = assets.flowMeta.deskCard;
  if (t < T.land) return [{ a: d.gap }, "gap"];
  if (t < T.approve) return [{ a: d.list }, "list"];
  if (t < T.toRequest) {
    const mix = smooth(T.approve, T.approve + 0.3, t);
    const ring = (t - T.approve) / 0.9;
    return [{ a: d.list, b: d.ready, mix, ring: { box, p: ring } }, `ready-${mix.toFixed(3)}-${clamp01(ring).toFixed(3)}`];
  }
  const slide = clamp01((t - T.toRequest) / 0.45);
  if (slide < 1) return [{ a: d.ready, slideTo: d.reqLight, slide }, `slide-${slide.toFixed(3)}`];
  const reveal = smooth(T.reveal[0], T.reveal[1], t);
  return [{ a: d.reqLight, dark: d.reqDark, reveal }, `req-${reveal.toFixed(3)}`];
}

async function renderAt(t) {
  const usePhone = t < T.cut;
  const night = smooth(T.dim[0], T.dim[1], t);
  g.setTransform(W / 1920, 0, 0, H / 1080, 0, 0);
  drawBackground(g, t, night, usePhone ? "phone" : "laptop");

  if (usePhone) {
    setCamera(PHONE_CAM, t);
    // Парение — едва заметное: медленный подъём и лёгкий наклон.
    const bob = 0.016 * Math.sin((2 * Math.PI * t) / 4.2);
    phone.group.position.set(0, bob, 0);
    phone.group.rotation.set(0.016 * Math.sin((2 * Math.PI * t) / 5.6) - 0.015, track(PHONE_YAW, t)[0] + 0.015 * Math.sin((2 * Math.PI * t) / 7.2), 0.007 * Math.sin((2 * Math.PI * t) / 6.4));
    phone.group.updateMatrixWorld();
    phoneShadow.material.opacity = 0.3 - bob * 3;
    phoneShadow.scale.setScalar(1 - bob * 1.5);
    await updatePhoneScreen(t);

    // Заявка отрывается от экрана и летит в камеру.
    if (t >= T.lift) {
      const p = clamp01((t - T.lift) / (T.cut - T.lift));
      const start = {
        pos: phone.group.localToWorld(new THREE.Vector3(0, 0.22, phone.front + 0.01)),
        quat: phone.group.getWorldQuaternion(new THREE.Quaternion()),
        w: 0.64,
        h: 0.64 / phoneCard.userData.aspect,
      };
      const end = poseInFront(0.3, phoneCard.userData.aspect);
      placeCard(phoneCard, start, end, p ** 2.4, Math.sin(Math.PI * p) * 0.22, Math.sin(Math.PI * p) * 0.18, smooth(0, 0.08, p));
    } else phoneCard.visible = false;
    renderer.render(phoneScene, camera);
  } else {
    setCamera(LAPTOP_CAM, t);
    laptop.group.updateMatrixWorld();
    const [state, key] = laptopState(t);
    laptopScreen.draw(state, key);
    // Ночь: гасим окружение и ключевой свет, экран светит на клавиатуру.
    laptopScene.environmentIntensity = THREE.MathUtils.lerp(1, 0.05, night);
    key2.intensity = THREE.MathUtils.lerp(1.5, 0, night);
    glow.intensity = THREE.MathUtils.lerp(0, 1.4, night);
    laptopShadow.material.opacity = THREE.MathUtils.lerp(0.34, 0.6, night);
    laptop.screenMat.color.setScalar(THREE.MathUtils.lerp(1, 0.94, night));

    if (t < T.land) {
      const p = clamp01((t - T.cut) / (T.land - T.cut));
      const box = assets.flowMeta.deskCard;
      const center = laptopScreenPoint(box.x + box.width / 2, box.y + box.height / 2, laptop);
      const w = (box.width / 1280) * LAPTOP.screenW;
      const end = {
        pos: laptop.lid.localToWorld(center),
        quat: laptop.lid.getWorldQuaternion(new THREE.Quaternion()),
        w,
        h: w / deskCard.userData.aspect,
      };
      const start = poseInFront(0.3, deskCard.userData.aspect);
      const e = 1 - (1 - p) ** 3;
      placeCard(deskCard, start, end, e, Math.sin(Math.PI * e) * 0.12, Math.sin(Math.PI * e) * -0.12, 1);
    } else deskCard.visible = false;
    renderer.render(laptopScene, camera);
  }

  g.drawImage(renderer.domElement, 0, 0, 1920, 1080);

  // Подписи.
  // Знак в углу прячем на крупном плане ноутбука: там он ложится на рамку экрана.
  const closeUp = t >= T.cut - 0.05 ? 1 - smooth(T.toRequest + 0.6, T.pullBack, t) : 0;
  drawBrand(g, smooth(0.4, 1.1, t) * (1 - closeUp) * (1 - smooth(T.end - 0.2, T.end + 0.4, t)), night);
  FEATURES.forEach((ft, i) => {
    const s = T.features + i * T.featureLen;
    drawCaption(g, t, { start: s + 0.12, end: s + T.featureLen - 0.02, title: ft.title, sub: ft.sub });
  });
  drawCaption(g, t, { start: T.form + 0.12, end: T.lift + 0.25, title: "Заявка в пару касаний", sub: "Статус придёт в уведомления" });
  drawCaption(g, t, { start: T.toRequest + 0.7, end: T.dim[0] + 0.45, title: "На любом устройстве", align: "center", x: 960, y: 128, size: 72 });
  drawCaption(g, t, { start: T.reveal[0] + 0.4, end: T.end + 0.35, title: "И днём, и ночью", align: "center", x: 960, y: 128, size: 72, night: 1 });
  drawFlash(g, clamp01(1 - Math.abs(t - T.cut) / 0.17) ** 1.4);
  drawEndCard(g, t, T.end);
  drawFade(g, smooth(DURATION - 0.7, DURATION, t));
}

async function sendBytes(bytes, name) {
  const step = 1 << 21;
  for (let i = 0; i < bytes.length; i += step) {
    const part = bytes.subarray(i, i + step);
    let s = "";
    for (let j = 0; j < part.length; j += 0x8000) s += String.fromCharCode(...part.subarray(j, j + 0x8000));
    await window.saveChunk(name, btoa(s), i === 0);
  }
}

window.renderStills = async (times) => {
  await load();
  for (const t of times) {
    await renderAt(t);
    const blob = await new Promise((r) => out.toBlob(r, "image/png"));
    await sendBytes(new Uint8Array(await blob.arrayBuffer()), `still-${String(t.toFixed(2)).padStart(5, "0")}.png`);
  }
};

window.renderVideo = async ({ from = 0, to = DURATION, name = "video.mp4", bitrate = 24e6, variants = [] } = {}) => {
  await load();
  // Звук: для каждого варианта музыки — сведение, WAV рядом с роликом (для монтажа) и Opus для MP4.
  const sounds = [];
  for (const v of variants) {
    const mix = await mixScore(await decode(v.url), v.plan, T, DURATION);
    await sendBytes(toWav(mix), `${v.name}.wav`);
    sounds.push({ name: `${v.name}.mp4`, chunks: await encodeOpus(mix) });
  }

  // Видео кодируется один раз; варианты отличаются только звуком.
  const video = [];
  let failure = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => video.push({ chunk, meta }), error: (e) => (failure = e) });
  // High 4.2 — уровень, на котором 1080p допускает 60 к/с (4.0 — только до 30).
  encoder.configure({ codec: "avc1.64002A", width: W, height: H, bitrate, framerate: FPS, latencyMode: "quality", avc: { format: "avc" } });
  const first = Math.round(from * FPS);
  const last = Math.round(to * FPS);
  const started = performance.now();
  for (let i = first; i < last; i++) {
    if (failure) throw failure;
    await renderAt(i / FPS);
    const frame = new VideoFrame(out, { timestamp: Math.round(((i - first) * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    encoder.encode(frame, { keyFrame: (i - first) % (FPS * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 3) await new Promise((r) => encoder.addEventListener("dequeue", r, { once: true }));
    if ((i - first) % 120 === 0) await window.progress(i - first, last - first, Math.round(performance.now() - started));
  }
  await encoder.flush();
  if (failure) throw failure;

  for (const s of sounds.length ? sounds : [{ name, chunks: null }]) {
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width: W, height: H, frameRate: FPS },
      ...(s.chunks ? { audio: { codec: "opus", numberOfChannels: 2, sampleRate: SR } } : {}),
      fastStart: "in-memory",
    });
    // Дорожки вперемешку по времени — так плееру не нужно прыгать по файлу.
    let k = 0;
    for (const v of video) {
      while (s.chunks && k < s.chunks.length && s.chunks[k].chunk.timestamp <= v.chunk.timestamp) muxer.addAudioChunk(s.chunks[k].chunk, s.chunks[k++].meta);
      muxer.addVideoChunk(v.chunk, v.meta);
    }
    while (s.chunks && k < s.chunks.length) muxer.addAudioChunk(s.chunks[k].chunk, s.chunks[k++].meta);
    muxer.finalize();
    await sendBytes(new Uint8Array(muxer.target.buffer), s.name);
  }
};

window.analyzeTracks = async (urls) => {
  const out = {};
  for (const url of urls) out[url] = analyze(await decode(url));
  return out;
};

window.ready = true;
