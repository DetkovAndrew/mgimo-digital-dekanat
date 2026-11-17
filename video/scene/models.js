// Модели сцены: телефон, ноутбук (в духе алюминиевого ноутбука, без логотипов и узнаваемых деталей), летящая карточка
// заявки и мягкие тени. Всё из примитивов three.js — без внешних моделей и их лицензий.
import * as THREE from "three";

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Плоская скруглённая пластина с UV 0..1 по габаритам — под текстуру экрана. */
function roundedPlane(w, h, r, segments = 24) {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), segments);
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = pos.getX(i) / w + 0.5;
    uv[2 * i + 1] = pos.getY(i) / h + 0.5;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

function slab(w, h, r, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * bevel, h - 2 * bevel, Math.max(0.001, r - bevel)), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 40,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export const PHONE = { w: 0.75, h: 1.62, screenW: 0.7, screenH: 0.7 * (844 / 390) };

export function makePhone(screenTexture) {
  const group = new THREE.Group();
  const depth = 0.058;
  const bevel = 0.015;
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x08090d, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 });
  const frame = new THREE.MeshPhysicalMaterial({ color: 0x3a4052, metalness: 0.95, roughness: 0.26 });
  const body = new THREE.Mesh(slab(PHONE.w, PHONE.h, 0.12, depth, bevel), [glass, frame]);
  group.add(body);
  const front = depth / 2 + bevel;

  const screen = new THREE.Mesh(roundedPlane(PHONE.screenW, PHONE.screenH, 0.088), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.position.z = front + 0.0006;
  group.add(screen);
  // Стекло поверх экрана: только отражение окружения (сложение), сам экран не темнеет.
  const sheen = new THREE.Mesh(
    roundedPlane(PHONE.screenW + 0.02, PHONE.screenH + 0.02, 0.098),
    new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.22, envMapIntensity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sheen.position.z = front + 0.0012;
  group.add(sheen);

  // Кнопки на рамке.
  const btn = (x, y, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, h, 0.022), frame);
    m.position.set(x, y, 0);
    group.add(m);
  };
  btn(PHONE.w / 2 + 0.004, 0.33, 0.17);
  btn(-PHONE.w / 2 - 0.004, 0.42, 0.11);
  btn(-PHONE.w / 2 - 0.004, 0.27, 0.11);

  return { group, screen, front };
}

export const LAPTOP = { baseW: 2.9, baseD: 2.0, lidH: 1.92, screenW: 2.7, screenH: 2.7 / 1.6, chin: 0.1, openTilt: 0.3 };

function keyboardTexture() {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 760;
  const g = c.getContext("2d");
  g.fillStyle = "#2b2e36";
  g.fillRect(0, 0, c.width, c.height);
  const rows = [14, 14, 13, 12, 11];
  const pad = 30;
  const gap = 14;
  const rowH = (c.height - pad * 2 - gap * 5) / 6;
  const key = (x, y, w, h) => {
    g.fillStyle = "#121419";
    g.beginPath();
    g.roundRect(x, y, w, h, 10);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.fillRect(x + 6, y + 4, w - 12, 2);
  };
  // Ряд функциональных клавиш — ниже ростом.
  const fnH = rowH * 0.6;
  const fnW = (c.width - pad * 2 - gap * 13) / 14;
  for (let i = 0; i < 14; i++) key(pad + i * (fnW + gap), pad, fnW, fnH);
  let y = pad + fnH + gap;
  for (let r = 0; r < rows.length; r++) {
    const n = rows[r];
    const unit = (c.width - pad * 2 - gap * (n - 1)) / (n + (r === 4 ? 6 : r === 0 ? 0.5 : 1));
    let x = pad;
    for (let i = 0; i < n; i++) {
      let w = unit;
      if (r === 0 && i === n - 1) w = unit * 1.5;
      if (r > 0 && r < 4 && (i === 0 || i === n - 1)) w = unit * (r === 1 ? 1.5 : r === 2 ? 1.75 : 2.25) * 0.75;
      if (r === 4 && i === Math.floor(n / 2)) w = unit * 6.6; // пробел
      key(x, y, w, rowH);
      x += w + gap;
    }
    y += rowH + gap;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeLaptop(screenTexture) {
  const group = new THREE.Group();
  const alu = new THREE.MeshPhysicalMaterial({ color: 0xd3d6dc, metalness: 1, roughness: 0.34 });
  const aluDark = new THREE.MeshPhysicalMaterial({ color: 0x9da2ab, metalness: 1, roughness: 0.4 });
  const bt = 0.046;
  const bev = 0.012;
  const base = new THREE.Mesh(slab(LAPTOP.baseW, LAPTOP.baseD, 0.1, bt, bev), alu);
  base.geometry.rotateX(-Math.PI / 2);
  base.position.y = bt / 2 + bev;
  group.add(base);
  const top = bt + 2 * bev;

  const kb = new THREE.Mesh(new THREE.PlaneGeometry(2.46, 0.92), new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.62, metalness: 0.2 }));
  kb.rotation.x = -Math.PI / 2;
  kb.position.set(0, top + 0.0008, -0.38);
  group.add(kb);
  const pad = new THREE.Mesh(roundedPlane(1.2, 0.74, 0.05), new THREE.MeshPhysicalMaterial({ color: 0xc4c8cf, metalness: 0.85, roughness: 0.22 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, top + 0.0006, 0.47);
  group.add(pad);

  // Крышка: петля у заднего края, наклон назад.
  const lid = new THREE.Group();
  lid.position.set(0, top - 0.004, -LAPTOP.baseD / 2 + 0.05);
  lid.rotation.x = -LAPTOP.openTilt;
  group.add(lid);
  const lt = 0.022;
  const lbev = 0.008;
  const shell = new THREE.Mesh(slab(LAPTOP.baseW, LAPTOP.lidH, 0.1, lt, lbev), alu);
  shell.position.y = LAPTOP.lidH / 2;
  lid.add(shell);
  const front = lt / 2 + lbev;
  const bezel = new THREE.Mesh(
    roundedPlane(LAPTOP.baseW - 0.03, LAPTOP.lidH - 0.03, 0.088),
    new THREE.MeshPhysicalMaterial({ color: 0x06070a, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04 }),
  );
  bezel.position.set(0, LAPTOP.lidH / 2, front + 0.0005);
  lid.add(bezel);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  const screen = new THREE.Mesh(roundedPlane(LAPTOP.screenW, LAPTOP.screenH, 0.012), screenMat);
  const screenY = LAPTOP.chin + LAPTOP.screenH / 2;
  screen.position.set(0, screenY, front + 0.001);
  lid.add(screen);
  const sheen = new THREE.Mesh(
    roundedPlane(LAPTOP.screenW, LAPTOP.screenH, 0.012),
    new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.07, envMapIntensity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sheen.position.copy(screen.position);
  sheen.position.z += 0.0008;
  lid.add(sheen);
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), new THREE.MeshBasicMaterial({ color: 0x15171d }));
  cam.position.set(0, LAPTOP.chin + LAPTOP.screenH + (LAPTOP.lidH - LAPTOP.chin - LAPTOP.screenH) / 2, front + 0.0012);
  lid.add(cam);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 32), aluDark);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, top + 0.01, -LAPTOP.baseD / 2 + 0.06);
  group.add(hinge);

  return { group, lid, screen, screenMat, screenY, front };
}

/** Точка на экране ноутбука по CSS-пикселям снимка 1280×800 → локальные координаты крышки. */
export function laptopScreenPoint(x, y, laptop) {
  return new THREE.Vector3((x / 1280 - 0.5) * LAPTOP.screenW, laptop.screenY + (0.5 - y / 800) * LAPTOP.screenH, laptop.front + 0.004);
}

export function softShadow(w, h, opacity) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grad.addColorStop(0, "rgba(10,12,30,1)");
  grad.addColorStop(0.45, "rgba(10,12,30,0.55)");
  grad.addColorStop(1, "rgba(10,12,30,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Карточка заявки: снимок строки списка на белой скруглённой подложке. */
export function makeCard(img, cssW, cssH) {
  const pad = 0;
  const c = document.createElement("canvas");
  c.width = img.width + pad * 2;
  c.height = img.height + pad * 2;
  const g = c.getContext("2d");
  const r = 16 * (img.width / cssW);
  g.save();
  g.beginPath();
  g.roundRect(pad, pad, img.width, img.height - 2, r);
  g.clip();
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, pad, pad);
  g.restore();
  g.strokeStyle = "#dfe3ef";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(pad + 1, pad + 1, img.width - 2, img.height - 4, r);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  mesh.userData.aspect = cssW / cssH;
  return mesh;
}
