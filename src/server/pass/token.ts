import "server-only";
import { createHmac, hkdfSync } from "node:crypto";
import { PASS_PREFIX, PASS_TOKEN_BYTES, PASS_WINDOW_MS, type PassCode } from "@/lib/pass/code";

/** Чистое вычисление: секрет передаёт серверный DAL; в QR нет ID, времени или профиля. */
export function createPassCode(studentId: string, secret: string, now: number): PassCode {
  if (!secret || !studentId || !Number.isSafeInteger(now) || now < 0) throw new Error("Не удалось создать демо-пропуск.");
  const window = Math.floor(now / PASS_WINDOW_MS);
  const key = hkdfSync("sha256", secret, new Uint8Array(), "univ-pass-v1", 32);
  // JSON-массив однозначно разделяет ID и окно; ключ HMAC отделён от остальных назначений секрета через HKDF.
  const token = createHmac("sha256", key).update(JSON.stringify([studentId, window])).digest().subarray(0, PASS_TOKEN_BYTES).toString("base64url");
  return { payload: `${PASS_PREFIX}${token}`, expiresAt: new Date((window + 1) * PASS_WINDOW_MS).toISOString() };
}
