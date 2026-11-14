import "server-only";
import { createHmac, hkdfSync } from "node:crypto";
import { addDays, mskDayKey, mskStartOfDay } from "@/lib/format";
import { GUEST_SSID, WIFI_COOLDOWN_MIN, WIFI_SSID, wifiQrPayload } from "@/lib/services/wifi";
import { prisma } from "../db";
import { requireStudent } from "../session";

// Wi-Fi (docs/plans/services.md). Пароли не хранятся: HMAC от секрета сервера. Ключ отделён от остальных назначений
// секрета через HKDF, как у демо-пропуска. Только свой: id в адресе нет, студент берётся из сессии.

// Без похожих символов (l/1, o/0): пароль переписывают с экрана телефона на ноутбук.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function derive(secret: string, parts: unknown[], groups: number): string {
  if (!secret) throw new Error("Не задан секрет сервера.");
  const key = hkdfSync("sha256", secret, new Uint8Array(), "univ-wifi-v1", 32);
  const bytes = createHmac("sha256", key).update(JSON.stringify(parts)).digest();
  const chars = Array.from(bytes.subarray(0, groups * 4), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

/** Личный пароль: меняется вместе с версией. 12 символов из 31 — около 59 бит. */
export const wifiPassword = (secret: string, studentId: string, version: number) => derive(secret, ["personal", studentId, version], 3);
/** Код гостевой сети на день по Москве: общий для всех, меняется в полночь. */
export const guestCode = (secret: string, day: string) => derive(secret, ["guest", day], 2);

const secret = () => process.env.BETTER_AUTH_SECRET ?? "";

export async function getMyWifi(now = new Date()) {
  const { studentId, userId } = await requireStudent();
  const [cred, user] = await Promise.all([
    prisma.wifiCredential.findUnique({ where: { studentId }, select: { version: true, rotatedAt: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
  ]);
  const day = mskDayKey(now);
  const code = guestCode(secret(), day);
  return {
    ssid: WIFI_SSID,
    login: user?.username ?? "",
    password: wifiPassword(secret(), studentId, cred?.version ?? 1),
    rotatedAt: cred?.rotatedAt ?? null,
    nextRotationAt: cred ? new Date(cred.rotatedAt.getTime() + WIFI_COOLDOWN_MIN * 60_000) : null,
    guest: { ssid: GUEST_SSID, code, validUntil: mskStartOfDay(addDays(mskStartOfDay(now), 1)), qr: wifiQrPayload(GUEST_SSID, code) },
  };
}

/**
 * Новый пароль Wi-Fi: одна атомарная вставка-обновление. Условие по времени стоит в самом UPDATE,
 * поэтому из двух одновременных смен проходит одна (ревью Codex 47).
 */
export async function rotateMyWifiPassword(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { studentId } = await requireStudent();
  const rows = await prisma.$queryRaw<{ version: number }[]>`
    INSERT INTO "wifi_credential" ("studentId", "version", "rotatedAt") VALUES (${studentId}, 2, now())
    ON CONFLICT ("studentId") DO UPDATE SET "version" = "wifi_credential"."version" + 1, "rotatedAt" = now()
    WHERE "wifi_credential"."rotatedAt" < now() - make_interval(mins => ${WIFI_COOLDOWN_MIN})
    RETURNING "version"`;
  if (!rows.length) return { ok: false, error: `Пароль меняли меньше ${WIFI_COOLDOWN_MIN} минут назад. Попробуйте позже.` };
  return { ok: true };
}
