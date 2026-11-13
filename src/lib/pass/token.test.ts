import { describe, expect, it, vi } from "vitest";
import { isPassCode, PASS_TOKEN_BYTES, PASS_WINDOW_MS } from "./code";
import { passQrSource } from "./qr";
import { createPassCode } from "@/server/pass/token";

vi.mock("server-only", () => ({}));

const secret = "public-test-fixture-for-pass-secret";
const student = "student-alpha-record-private-12345";
const boundary = Date.parse("2026-11-12T07:15:00.000Z");

describe("демо-пропуск", () => {
  it("детерминирован в пределах 30-секундного окна, меняется строго на границе", () => {
    const first = createPassCode(student, secret, boundary);
    expect(createPassCode(student, secret, boundary + PASS_WINDOW_MS - 1)).toEqual(first);
    expect(first.expiresAt).toBe("2026-11-12T07:15:30.000Z");
    const next = createPassCode(student, secret, boundary + PASS_WINDOW_MS);
    expect(next.payload).not.toBe(first.payload);
    expect(next.expiresAt).toBe("2026-11-12T07:16:00.000Z");
  });

  it("различается у студентов и при смене секрета, содержит только непрозрачный base64url-токен", () => {
    const code = createPassCode(student, secret, boundary);
    expect(createPassCode("student-beta-record-private-67890", secret, boundary).payload).not.toBe(code.payload);
    expect(createPassCode(student, "another-public-test-secret", boundary).payload).not.toBe(code.payload);
    expect(code.payload).toMatch(/^UNIV-PASS:v1:[A-Za-z0-9_-]{24}$/);
    expect(Buffer.from(code.payload.split(":").at(-1)!, "base64url")).toHaveLength(PASS_TOKEN_BYTES);
    expect(code.payload).not.toContain(student);
    expect(code.payload).not.toContain(secret);
    expect(isPassCode(code)).toBe(true);
    expect(isPassCode({ ...code, payload: `<svg onload="alert(1)">` })).toBe(false);
    expect(isPassCode({ ...code, expiresAt: "invalid" })).toBe(false);
  });

  it("при отсутствии секрета не выдаёт предсказуемый запасной код", () => {
    expect(() => createPassCode(student, "", boundary)).toThrow();
  });

  it("QR остаётся чёрным на белом с тихой зоной в обеих темах", () => {
    const svg = decodeURIComponent(passQrSource(createPassCode(student, secret, boundary).payload).split(",")[1]);
    expect(svg).toContain('viewBox="0 0 222 222"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).not.toContain(student);
  });
});
