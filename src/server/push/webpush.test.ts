import { createPublicKey, verify } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { encryptPayload, fromB64u, isAuthSecret, isPushEndpoint, isUaPublicKey, vapidAuthorization, vapidPublicKey } = await import("./webpush");

describe("шифрование RFC 8291", () => {
  // Пример из раздела 5 и приложения A RFC 8291: те же ключи и соль дают ровно это тело.
  it("совпадает с вектором RFC", () => {
    const body = encryptPayload(
      Buffer.from("When I grow up, I want to be a watermelon"),
      { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" },
      { salt: fromB64u("DGv6ra1nlYgDCS1FRnbzlw"), senderPrivateKey: fromB64u("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw") },
    );
    expect(body.toString("base64url")).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });
});

describe("VAPID", () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-for-vapid-0123456789";
  });

  it("JWT подписан ключом, который получает браузер, и адресован службе", () => {
    const now = Date.UTC(2026, 10, 21, 12);
    const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", now);
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(vapidPublicKey());
    const [h, p, s] = t.split(".");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.exp).toBe(now / 1000 + 12 * 3600);
    const raw = fromB64u(k);
    const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") }, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }, fromB64u(s))).toBe(true);
  });
});

describe("адрес и ключи подписки", () => {
  it("пускает только службы push по https", () => {
    for (const ok of ["https://fcm.googleapis.com/fcm/send/x", "https://web.push.apple.com/QG", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://wns2-db5p.notify.windows.com/w/?token=x"]) {
      expect(isPushEndpoint(ok), ok).toBe(true);
    }
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user@fcm.googleapis.com/x",
      "https://fcm.googleapis.com.evil.ru/x",
      "https://evilpush.apple.com/x",
      "https://127.0.0.1/x",
      "https://localhost/x",
      "javascript:alert(1)",
      "не адрес",
      `https://fcm.googleapis.com/${"a".repeat(1100)}`,
    ]) {
      expect(isPushEndpoint(bad), bad).toBe(false);
    }
  });

  it("ключ браузера — точка P-256, секрет — 16 байт", () => {
    expect(isUaPublicKey("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4")).toBe(true);
    expect(isUaPublicKey(Buffer.alloc(65, 4).toString("base64url"))).toBe(false); // не на кривой
    expect(isUaPublicKey("BCVx")).toBe(false);
    expect(isAuthSecret("BTBZMqHH6r4Tts7J_aSIgg")).toBe(true);
    expect(isAuthSecret("BTBZMqHH6r4Tts7J")).toBe(false);
  });
});
