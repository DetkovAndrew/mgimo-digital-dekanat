// Фото профиля (docs/plans/avatars.md): проверка файла по сигнатуре и размерам, отдача только владельцу, A/B.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/avatar/route";
import { AVATAR_MAX_BYTES, removeMyAvatar, resetAvatarLimits, sniffImage, uploadMyAvatar } from "@/server/dal/avatar";
import { prisma } from "@/server/db";
import * as session from "@/server/session";
import { actAs, makeStudent } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

type Who = Awaited<ReturnType<typeof actAs>>;
let A: Who, B: Who;
const tag = Date.now().toString(36);

const enc = new TextEncoder();
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0);
  return out;
};
const be32 = (n: number) => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const le32 = (n: number) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24]);
const chunk = (type: string, data: Uint8Array) => cat(be32(data.length), enc.encode(type), data, new Uint8Array(4));

/** PNG из блоков (сервер пиксели не декодирует, проверяет структуру): IHDR, необязательные блоки, IEND. */
function png(width: number, height: number, { pad = 0, extra = [] as Uint8Array[], end = true } = {}) {
  const ihdr = cat(be32(width), be32(height), new Uint8Array([8, 6, 0, 0, 0]));
  return cat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), ...extra, chunk("IDAT", new Uint8Array(pad)), end ? chunk("IEND", new Uint8Array()) : new Uint8Array());
}
function webp(chunks: Uint8Array[]) {
  const body = cat(enc.encode("WEBP"), ...chunks);
  return cat(enc.encode("RIFF"), le32(body.length), body);
}
const riffChunk = (type: string, data: Uint8Array) => cat(enc.encode(type), le32(data.length), data, data.length & 1 ? new Uint8Array(1) : new Uint8Array());
const vp8x = (w: number, h: number, flags = 0) => riffChunk("VP8X", new Uint8Array([flags, 0, 0, 0, (w - 1) & 255, (w - 1) >> 8, 0, (h - 1) & 255, (h - 1) >> 8, 0]));
const file = (bytes: Uint8Array<ArrayBuffer>, type: string) => new Blob([bytes], { type });
async function as(who: Who, username: string) {
  await actAs(username);
  vi.mocked(session.studentForApi).mockResolvedValue({ ok: true, student: who });
}

beforeAll(async () => {
  resetAvatarLimits();
  A = await makeStudent(`ava-a-${tag}`);
  B = await makeStudent(`ava-b-${tag}`);
});
afterAll(async () => {
  await prisma.studentAvatar.deleteMany({ where: { studentId: { in: [A.studentId, B.studentId] } } });
  await prisma.$disconnect();
});

describe("проверка файла", () => {
  it("узнаёт PNG, JPEG и WebP по структуре и их размеры; анимацию и обрезанные файлы — нет", () => {
    expect(sniffImage(png(256, 200))).toEqual({ mime: "image/png", width: 256, height: 200 });
    expect(sniffImage(png(256, 200, { end: false }))).toBeNull(); // обрезан: нет IEND
    expect(sniffImage(png(256, 200, { extra: [chunk("acTL", new Uint8Array(8))] }))).toBeNull(); // APNG
    const sof = [0xff, 0xc0, 0, 11, 8, 0, 120, 0, 160, 1, 1, 0x11, 0]; // SOF0: длина 11, 120×160, одна компонента
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, ...sof, 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
    expect(sniffImage(jpeg)).toEqual({ mime: "image/jpeg", width: 160, height: 120 });
    expect(sniffImage(jpeg.slice(0, -2))).toBeNull(); // нет конца EOI
    expect(sniffImage(webp([vp8x(256, 128), riffChunk("VP8L", new Uint8Array([0x2f, 255, 0, 0, 0]))]))).toEqual({ mime: "image/webp", width: 256, height: 128 });
    expect(sniffImage(webp([vp8x(256, 128, 0x02), riffChunk("ANIM", new Uint8Array(6))]))).toBeNull(); // анимированный
    const short = webp([vp8x(64, 64)]);
    expect(sniffImage(short.slice(0, -2))).toBeNull(); // размер RIFF не совпал с файлом
    expect(sniffImage(enc.encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
  });

  it("отказ: тип не совпал с сигнатурой, HTML под видом картинки, SVG, большой файл, большое разрешение", async () => {
    await as(A, `ava-a-${tag}`);
    expect((await uploadMyAvatar(file(png(256, 256), "image/webp"))).ok).toBe(false);
    expect((await uploadMyAvatar(file(enc.encode("<html><script>alert(1)</script></html>"), "image/png"))).ok).toBe(false);
    expect((await uploadMyAvatar(file(enc.encode("<svg/>"), "image/svg+xml"))).ok).toBe(false);
    expect((await uploadMyAvatar(file(cat(png(256, 256), enc.encode("<script>alert(1)</script>")), "image/png"))).ok).toBe(false); // хвост после IEND
    expect((await uploadMyAvatar(file(png(256, 256, { pad: AVATAR_MAX_BYTES }), "image/png"))).ok).toBe(false);
    expect((await uploadMyAvatar(file(png(2048, 2048), "image/png"))).ok).toBe(false);
    expect((await uploadMyAvatar("не файл")).ok).toBe(false);
    expect(await prisma.studentAvatar.count({ where: { studentId: A.studentId } })).toBe(0);
  });
});

describe("доступ A/B", () => {
  it("у A и B разные фото: каждый получает только своё (A → B → A); без входа — 401; ошибки не кешируются", async () => {
    const [bytesA, bytesB] = [png(256, 256, { pad: 300 }), png(200, 200, { pad: 500 })];
    await as(A, `ava-a-${tag}`);
    expect(await uploadMyAvatar(file(bytesA, "image/png"))).toEqual({ ok: true });
    await as(B, `ava-b-${tag}`);
    expect((await GET()).status).toBe(404); // у B ещё нет фото, фото A ему не отдаётся
    expect(await uploadMyAvatar(file(bytesB, "image/png"))).toEqual({ ok: true });

    for (const [who, name, bytes] of [[A, "a", bytesA], [B, "b", bytesB], [A, "a", bytesA]] as const) {
      await as(who, `ava-${name}-${tag}`);
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toContain("sandbox");
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    }

    vi.mocked(session.studentForApi).mockResolvedValue({ ok: false, status: 401 });
    const anon = await GET();
    expect(anon.status).toBe(401);
    expect(anon.headers.get("cache-control")).toBe("private, no-store");
  });

  it("удаление B не трогает фото A; своё удаляется", async () => {
    await as(B, `ava-b-${tag}`);
    await removeMyAvatar();
    expect(await prisma.studentAvatar.count({ where: { studentId: B.studentId } })).toBe(0);
    expect(await prisma.studentAvatar.count({ where: { studentId: A.studentId } })).toBe(1);
    await as(A, `ava-a-${tag}`);
    await removeMyAvatar();
    expect(await prisma.studentAvatar.count({ where: { studentId: A.studentId } })).toBe(0);
  });

  it("не чаще 10 замен в час на студента", async () => {
    resetAvatarLimits();
    await as(A, `ava-a-${tag}`);
    const results = [];
    for (let i = 0; i < 11; i++) results.push((await uploadMyAvatar(file(png(64, 64), "image/png"))).ok);
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(results.at(-1)).toBe(false);
    resetAvatarLimits();
  });
});
