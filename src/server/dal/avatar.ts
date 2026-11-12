import "server-only";
import { prisma } from "../db";
import { requireStudent } from "../session";

// Фото профиля (docs/plans/avatars.md). Браузер уже обрезал и сжал картинку; сервер ей не верит:
// тип определяется по сигнатуре файла, размер и разрешение ограничены. Владелец — только из сессии.

export const AVATAR_MAX_BYTES = 200 * 1024;
export const AVATAR_MAX_SIDE = 512;
const MIMES = ["image/webp", "image/jpeg", "image/png"] as const;
type Mime = (typeof MIMES)[number];

export type AvatarResult = { ok: true } | { ok: false; error: string };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000;
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/**
 * Тип и размеры картинки по её структуре. Проходим контейнер целиком, а не только заголовок: обрезанный файл,
 * мусор вместо блоков, анимация (APNG, анимированный WebP) — null. Пиксели не декодируем: отдаём байты как есть,
 * но только владельцу и с заголовками nosniff и CSP sandbox (src/app/api/avatar/route.ts).
 */
export function sniffImage(b: Uint8Array): { mime: Mime; width: number; height: number } | null {
  return png(b) ?? jpeg(b) ?? webp(b);
}

function png(b: Uint8Array) {
  if (b.length < 45 || u32be(b, 0) !== 0x89504e47 || u32be(b, 4) !== 0x0d0a1a0a || ascii(b, 12, 4) !== "IHDR") return null;
  let i = 8;
  while (i + 12 <= b.length) {
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type) || i + 12 + len > b.length) return null;
    if (type === "acTL" || type === "fcTL") return null; // APNG
    if (type === "IEND") return i + 12 === b.length ? { mime: "image/png" as const, width: u32be(b, 16), height: u32be(b, 20) } : null; // хвост после IEND — нет
    i += 12 + len;
  }
  return null; // нет IEND: файл обрезан
}

function jpeg(b: Uint8Array) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff || b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9) return null;
  // Сегменты до начала данных (SOS); размеры — из маркера кадра SOFn.
  let i = 2;
  let size: { width: number; height: number } | null = null;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      i += 2;
      continue;
    }
    const len = u16be(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) {
      if (len < 8) return null;
      size = { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    if (marker === 0xda) return size && { mime: "image/jpeg" as const, ...size };
    i += 2 + len;
  }
  return null;
}

function webp(b: Uint8Array) {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const riff = u32le(b, 4) + 8;
  if (riff !== b.length && riff + 1 !== b.length) return null; // размер контейнера должен совпасть с файлом
  let size: { width: number; height: number } | null = null;
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = u32le(b, i + 4);
    if (!/^[A-Z0-9 ]{4}$/.test(type) || i + 8 + len > b.length) return null;
    const d = i + 8;
    if (type === "ANIM" || type === "ANMF") return null;
    if (type === "VP8X") {
      if (len < 10 || b[d] & 0x02) return null; // флаг анимации
      size = { width: 1 + u24le(b, d + 4), height: 1 + u24le(b, d + 7) };
    } else if (type === "VP8 ") {
      if (len < 10 || b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) return null;
      size ??= { width: u16le(b, d + 6) & 0x3fff, height: u16le(b, d + 8) & 0x3fff };
    } else if (type === "VP8L") {
      if (len < 5 || b[d] !== 0x2f) return null;
      size ??= { width: 1 + (b[d + 1] | ((b[d + 2] & 0x3f) << 8)), height: 1 + ((b[d + 2] >> 6) | (b[d + 3] << 2) | ((b[d + 4] & 0x0f) << 10)) };
    }
    i = d + len + (len & 1); // блоки выравниваются по чётной границе
  }
  return i === b.length || i === b.length + 1 ? size && { mime: "image/webp" as const, ...size } : null;
}

// Не чаще 10 замен в час на студента: каждая запись — до 200 КиБ в БД и журнал WAL. Счётчик в памяти, как у помощника:
// сервер работает одним процессом Node.
const UPLOADS_PER_HOUR = 10;
const uploads = new Map<string, number[]>();
function takeUploadSlot(studentId: string, now = Date.now()) {
  const recent = (uploads.get(studentId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= UPLOADS_PER_HOUR) return false;
  uploads.set(studentId, [...recent, now]);
  return true;
}
/** Для тестов. */
export const resetAvatarLimits = () => uploads.clear();

/** Проверка загружаемого файла без записи в БД. */
export async function checkAvatarFile(file: unknown): Promise<{ ok: true; mime: Mime; bytes: Uint8Array<ArrayBuffer> } | { ok: false; error: string }> {
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "Выберите фото" };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: "Фото слишком большое: до 200 КБ после сжатия" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const img = sniffImage(bytes);
  if (!img || img.mime !== file.type) return { ok: false, error: "Подходят только фото JPG, PNG или WebP" };
  if (!img.width || !img.height || img.width > AVATAR_MAX_SIDE || img.height > AVATAR_MAX_SIDE) return { ok: false, error: "Фото слишком большое по размеру" };
  return { ok: true, mime: img.mime, bytes };
}

export async function uploadMyAvatar(file: unknown): Promise<AvatarResult> {
  const { studentId } = await requireStudent();
  const r = await checkAvatarFile(file);
  if (!r.ok) return r;
  if (!takeUploadSlot(studentId)) return { ok: false, error: "Фото меняли слишком часто. Попробуйте через час." };
  await prisma.studentAvatar.upsert({ where: { studentId }, create: { studentId, data: r.bytes, mime: r.mime }, update: { data: r.bytes, mime: r.mime } });
  return { ok: true };
}

export async function removeMyAvatar(): Promise<AvatarResult> {
  const { studentId } = await requireStudent();
  await prisma.studentAvatar.deleteMany({ where: { studentId } });
  return { ok: true };
}

/** Адрес своего фото с версией (для обновления после замены) или null. */
export async function getMyAvatarUrl(): Promise<string | null> {
  const { studentId } = await requireStudent();
  const a = await prisma.studentAvatar.findUnique({ where: { studentId }, select: { updatedAt: true } });
  return a ? `/api/avatar?v=${a.updatedAt.getTime()}` : null;
}

/** Байты фото владельца сессии; studentId берётся только из studentForApi() в обработчике маршрута. */
export async function readAvatar(studentId: string) {
  const a = await prisma.studentAvatar.findUnique({ where: { studentId }, select: { data: true, mime: true } });
  return a && (MIMES as readonly string[]).includes(a.mime) ? a : null;
}
