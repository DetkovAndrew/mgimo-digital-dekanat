// Демонстрация «как студент пользуется кабинетом»: монтаж снятых планов (captures/demo, demo-capture.mjs) по шагам
// сценария жюри. Телефон — та же сцена, что в тизере, крупнее и почти анфас; деканат — ноутбук с курсором.
// Время здесь — от начала демонстрации; монтаж (порядок планов, переходы, подписи) задан ниже, длительности — из meta.
import { clamp01, drawStep, smooth } from "./overlay.js";
import { frameUrl, image } from "./screens.js";

const SLIDE = 0.42;

// Шаги и планы. in — как план появляется: slide (вглубь), back, fade (вкладка или новый шаг), flash (смена устройства).
// sub у плана — пояснение вместо общего для шага.
export const STEPS = [
  { title: "Вход", sub: "Логин и пароль студента.\nТестовые аккаунты — в комментарии к работе", shots: [{ name: "login", in: "fade" }] },
  { title: "Сегодня", sub: "Ближайшая пара, переносы\nи сроки — на первом экране", shots: [{ name: "today", in: "fade" }] },
  { title: "Расписание", sub: "Неделя с аудиториями\nи преподавателями. Перенос\nвиден прямо в карточке пары", shots: [{ name: "schedule", in: "fade" }] },
  {
    title: "Успеваемость",
    sub: "Баллы по каждой дисциплине\nи сколько осталось до зачёта",
    shots: [{ name: "grades", in: "fade" }, { name: "course", in: "slide" }],
  },
  {
    title: "Заявка на справку",
    sub: "Найти вид заявки, заполнить\nдва поля и отправить в деканат",
    shots: [
      { name: "requests", in: "fade" },
      { name: "form", in: "slide" },
      { name: "submitted", in: "slide", sub: "Заявка подана — статус\nвиден сразу и после перезахода" },
    ],
  },
  { title: "Деканат", sub: "Сотрудник в своём кабинете\nберёт заявку в работу\nи отмечает готовой", shots: [{ name: "staff", in: "flash" }] },
  {
    title: "Статус и справка",
    sub: "Уведомление, статус заявки\nи PDF с QR-кодом",
    shots: [
      { name: "bell", in: "flash" },
      { name: "notifications", in: "slide" },
      { name: "ready", in: "slide" },
      { name: "pdf", in: "slide" },
      { name: "verify", in: "fade", sub: "Работодатель проверяет\nсправку по QR-коду — без входа" },
    ],
  },
  {
    title: "Уведомления на телефон",
    sub: "Кабинет на экране «Домой»:\nв профиле — «Включить»",
    shots: [{ name: "today-push", in: "fade" }, { name: "push-on", in: "slide" }],
  },
  {
    title: "Перенос пары",
    sub: "Деканат переносит семинар\nв аудиторию — сервер проверяет\nнакладки и уведомляет группу",
    shots: [
      { name: "reschedule", in: "flash" },
      { name: "moved-push", in: "flash", sub: "Push приходит сразу —\nнажатие открывает неделю пары" },
      { name: "moved-schedule", in: "slide", sub: "В расписании — «Изменено»,\nбыло и стало, причина" },
      { name: "moved-lesson", in: "slide", sub: "Новая аудитория\nи путь до неё по схеме" },
    ],
  },
  {
    title: "Помощница Инвиктия",
    sub: "Отвечает по данным кабинета\nи готовит бронь. Бронирует —\nсам студент, одним нажатием",
    shots: [{ name: "ask", in: "fade" }, { name: "answer", in: "fade" }],
  },
  { title: "Как пройти", sub: "Маршрут до аудитории\nпо схеме корпуса", shots: [{ name: "today-route", in: "fade" }, { name: "route", in: "slide" }] },
  { title: "Профиль и тема", sub: "ФИО, факультет, направление,\nкурс и группа. Тёмная тема —\nв одно касание", shots: [{ name: "today-profile", in: "fade" }, { name: "profile", in: "slide" }] },
];

/** Монтаж: планы подряд, у каждого начало и длительность (из meta съёмки); у шагов — начало, конец и отрезки
 * пояснений (подряд идущие планы с одним пояснением). */
export function buildEdit(meta) {
  const items = [];
  const steps = [];
  let t = 0;
  STEPS.forEach((step, si) => {
    const from = t;
    const segs = [];
    for (const s of step.shots) {
      const m = meta.shots[s.name];
      if (!m) throw new Error(`нет плана ${s.name}: снимите его (demo-capture.mjs)`);
      const dur = m.device === "laptop" ? m.seconds : m.frames / m.fps;
      items.push({ ...s, step: si, start: t, dur, m });
      const sub = s.sub ?? step.sub;
      if (segs.at(-1)?.sub === sub) segs.at(-1).end = t + dur;
      else segs.push({ sub, start: t, end: t + dur });
      t += dur;
    }
    steps.push({ ...step, n: si + 1, start: from, end: t, segs });
  });
  return { items, steps, duration: t };
}

/** Кадр плана телефона в момент lt от его начала (неподвижный план — единственный кадр). */
function phoneFrame(item, lt) {
  const m = item.m;
  const i = m.still ? 0 : Math.max(0, Math.min(m.frames - 1, Math.round(lt * m.fps)));
  return image(frameUrl(item.name, i, "demo"));
}

// Камера телефона: шаги чередуют две близкие позиции — экран крупно и читаемо, движение медленное.
const POSES = [
  { cam: [-1.14, 0.1, 3.3, -0.5, 0.0, 0, 30], yaw: -0.13 },
  { cam: [-1.02, 0.06, 3.26, -0.48, 0.0, 0, 30], yaw: -0.09 },
];
// Ноутбук: камера по нормали к экрану (крышка откинута на 0.3 рад), экран — под подписью шага; в начале шага виден
// весь ноутбук, затем наезд до читаемого экрана (≈1 px на CSS px) и медленное приближение.
const DESK_CAM = [
  [0, [0.0, 2.95, 4.15, 0.0, 1.12, -1.28, 30]],
  [0.13, [0.0, 2.574, 2.878, 0.0, 1.272, -1.324, 30]],
  [1, [0.01, 2.556, 2.831, 0.0, 1.268, -1.323, 30]],
];

export function createDemo(ctx) {
  const { phone, phoneShadow, phoneScreen, laptop, laptopScreen, laptopScene, key2, glow, laptopShadow, track } = ctx;
  let edit;
  let phoneKeys;
  const deskStills = new Map();

  async function load() {
    const meta = await fetch("/captures/demo/meta.json").then((r) => r.json());
    edit = buildEdit(meta);
    // Ключи камеры: в начале и в конце телефонной части каждого шага — медленный наезд внутри шага.
    phoneKeys = [];
    edit.steps.forEach((step, si) => {
      const ph = edit.items.filter((it) => it.step === si && it.m.device === "phone");
      if (!ph.length) return;
      const from = ph[0].start;
      const to = ph.at(-1).start + ph.at(-1).dur;
      const p = POSES[si % 2];
      const [x, y, z, tx, ty, tz, fov] = p.cam;
      const a = phoneKeys.length ? from + 0.9 : from;
      phoneKeys.push([a, [x, y, z, tx, ty, tz, fov, p.yaw]]);
      phoneKeys.push([to, [x + 0.03, y - 0.01, z - 0.06, tx + 0.01, ty, tz, fov, p.yaw + 0.02]]);
    });
    for (const it of edit.items.filter((x) => x.m.device === "laptop"))
      deskStills.set(it.name, await Promise.all(it.m.stills.map((s) => image(`/captures/demo/${it.name}/${s.file}`))));
    return edit.duration;
  }

  const itemAt = (t) => {
    let k = 0;
    while (k + 1 < edit.items.length && edit.items[k + 1].start <= t) k++;
    return k;
  };

  /** Телефон: кадр, переход от прошлого плана, касания и круг новой темы. */
  async function drawPhone(k, t) {
    const it = edit.items[k];
    const lt = t - it.start;
    const cur = await phoneFrame(it, lt);
    const prevIt = k > 0 ? edit.items[k - 1] : null;
    const kind = it.in === "fade" ? "fade" : it.in === "back" ? "back" : "slide";
    const dur = it.in === "fade" && it.name === "answer" ? 0.2 : SLIDE;
    const slide = prevIt && prevIt.m.device === "phone" && it.in !== "flash" ? clamp01(lt / dur) : 1;
    const prev = slide < 1 ? await phoneFrame(prevIt, prevIt.dur) : null;
    // Касания этого плана и последнее касание прошлого (на нём начался переход).
    const tap = (tp, at) => ({ x: tp.x, y: tp.y + 88, p: (at - tp.t) / 0.45 });
    const taps = it.m.taps.map((tp) => tap(tp, lt));
    if (prevIt?.m.device === "phone") for (const tp of prevIt.m.taps) taps.push(tap(tp, lt + prevIt.dur));
    let reveal = null;
    const rv = it.m.taps.find((tp) => tp.reveal);
    if (rv && lt >= rv.t && lt < rv.t + 0.75) {
      const before = Math.max(0, Math.round(rv.t * it.m.fps) - 1);
      reveal = { img: await image(frameUrl(it.name, before, "demo")), x: rv.x, y: rv.y + 88, p: (lt - rv.t) / 0.75 };
    }
    // Push-уведомление поверх страницы: выезжает сверху и уходит вверх (рисует сцена — в снимок страницы оно не попадает).
    const b = it.m.banner;
    const banner = b && lt >= b.at ? { ...b, p: smooth(b.at, b.at + 0.4, lt) * (1 - smooth(b.until, b.until + 0.3, lt)), icon: await image("/scene/icon-192.png") } : null;
    phoneScreen.draw({ cur, prev, slide, kind, taps, reveal, banner });
  }

  /** Ноутбук деканата: снимок по времени, прокрутка, курсор к целям щелчков. */
  function drawDesk(it, lt) {
    const m = it.m;
    let s = 0;
    while (s + 1 < m.stills.length && m.stills[s + 1].t <= lt) s++;
    const imgs = deskStills.get(it.name);
    // Переход из списка в карточку — сдвигом, как в кабинете; дальше всё меняется на месте.
    const slide = s === 1 ? clamp01((lt - m.stills[1].t) / SLIDE) : 1;
    const scrollAt = (u) => (u < m.stills[1].t ? 0 : track(m.scroll.map(([a, y]) => [a, [y]]), u)[0]);
    const scroll = scrollAt(lt);
    // Курсор — в координатах экрана (при прокрутке колесом он стоит, страница едет): к цели за 0.75 с до щелчка.
    const pts = [{ t: 0, x: m.start.x, y: m.start.y }, ...m.cursor.map((c) => ({ t: c.t, x: c.x, y: c.y - scrollAt(c.t - 0.01) }))];
    let c = pts[0];
    let press = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const t0 = Math.max(a.t + 0.25, b.t - 0.75);
      if (lt >= b.t) c = b;
      else if (lt > t0) {
        const e = smooth(t0, b.t - 0.05, lt);
        c = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      }
      if (Math.abs(lt - b.t) < 0.12) press = 1 - Math.abs(lt - b.t) / 0.12;
    }
    const last = [...pts.slice(1)].reverse().find((p) => lt >= p.t);
    const ring = last ? { x: last.x, y: last.y, p: (lt - last.t) / 0.5 } : null;
    laptopScreen.drawDesk({ img: imgs[s], prev: s === 1 ? imgs[0] : null, slide, scroll, cursor: { x: c.x, y: c.y, press }, ring });
  }

  /** Состояние сцены на момент t демонстрации; возвращает, какую сцену рисовать, и подписи. */
  async function update(t, camera, setCamera) {
    const k = itemAt(t);
    const it = edit.items[k];
    const lt = t - it.start;
    if (it.m.device === "laptop") {
      setCamera(DESK_CAM.map(([u, v]) => [it.start + u * it.dur, v]), t);
      laptop.group.updateMatrixWorld();
      laptopScene.environmentIntensity = 1;
      key2.intensity = 1.5;
      glow.intensity = 0;
      laptopShadow.material.opacity = 0.34;
      laptop.screenMat.color.setScalar(1);
      drawDesk(it, lt);
      return { scene: "laptop", item: it };
    }
    const [px, py, pz, tx, ty, tz, fov, yaw] = track(phoneKeys, t);
    camera.position.set(px, py, pz);
    camera.lookAt(tx, ty, tz);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    const bob = 0.01 * Math.sin((2 * Math.PI * t) / 5.2);
    phone.group.position.set(0, bob, 0);
    phone.group.rotation.set(0.012 * Math.sin((2 * Math.PI * t) / 6.6) - 0.012, yaw + 0.01 * Math.sin((2 * Math.PI * t) / 8.4), 0.005 * Math.sin((2 * Math.PI * t) / 7.4));
    phone.group.updateMatrixWorld();
    phoneShadow.material.opacity = 0.3 - bob * 3;
    phoneShadow.scale.setScalar(1 - bob * 1.5);
    await drawPhone(k, t);
    return { scene: "phone", item: it };
  }

  /** Подписи шага и вспышка при смене устройства; a — общая непрозрачность (заставка и финал). */
  function overlay(g, t, a = 1) {
    const it = edit.items[itemAt(t)];
    const step = edit.steps[it.step];
    for (const seg of step.segs) {
      if (t < seg.start || t > seg.end) continue;
      drawStep(g, t, {
        n: step.n,
        of: edit.steps.length,
        title: step.title,
        sub: seg.sub,
        stepStart: step.start,
        stepEnd: step.end,
        segStart: seg.start,
        segEnd: seg.end,
        alpha: a,
        top: it.m.device === "laptop",
      });
    }
    for (const x of edit.items) if (x.in === "flash") drawFlashAt(g, t, x.start);
  }

  function drawFlashAt(g, t, at) {
    const v = clamp01(1 - Math.abs(t - at) / 0.16) ** 1.4;
    if (v <= 0) return;
    g.fillStyle = `rgba(255,255,255,${v})`;
    g.fillRect(0, 0, 1920, 1080);
  }

  /** Моменты для звука: касания, щелчки мыши, «дзынь» (справка готова, бронь), вспышки. */
  function cues(offset) {
    const taps = [];
    const clicks = [];
    const dings = [];
    const flashes = [];
    for (const it of edit.items) {
      if (it.in === "flash") flashes.push(offset + it.start);
      if (it.m.device === "laptop") {
        it.m.cursor.forEach((c) => clicks.push(offset + it.start + c.t));
        dings.push(offset + it.start + it.m.cursor.at(-1).t + 0.15);
        continue;
      }
      for (const tp of it.m.taps) taps.push(offset + it.start + tp.t);
      if (it.name === "answer") dings.push(offset + it.start + it.m.taps[0].t + 0.32);
      if (it.m.banner) dings.push(offset + it.start + it.m.banner.at);
    }
    return { taps, clicks, dings, flashes };
  }

  return { load, update, overlay, cues };
}
