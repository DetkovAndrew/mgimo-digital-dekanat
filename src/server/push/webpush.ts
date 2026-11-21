import "server-only";
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign, type ECDH } from "node:crypto";

// Web push без библиотеки: `web-push` — MPL-2.0, а в проекте только разрешающие лицензии (AGENTS.md).
// Шифрование — RFC 8291 (aes128gcm, RFC 8188), подпись сервера — VAPID (RFC 8292). План — docs/plans/push.md.

const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");
export const fromB64u = (s: string) => Buffer.from(s, "base64url");

/** Службы push браузеров. Сервер шлёт POST на адрес из запроса студента — только сюда (иначе SSRF). */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/, /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];

export function isPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > 1024) return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  return u.protocol === "https:" && !u.port && !u.username && !u.password && PUSH_HOSTS.some((re) => re.test(u.hostname));
}

/** Публичный ключ браузера: 65 байт, несжатая точка P-256. Точку на кривой проверяет computeSecret. */
export function isUaPublicKey(key: string): boolean {
  const raw = fromB64u(key);
  if (raw.length !== 65 || raw[0] !== 4 || b64u(raw) !== key) return false;
  try {
    const e = createECDH("prime256v1");
    e.generateKeys();
    e.computeSecret(raw);
    return true;
  } catch {
    return false;
  }
}

export const isAuthSecret = (key: string) => fromB64u(key).length === 16 && b64u(fromB64u(key)) === key;

// ─── Ключ VAPID: из секрета сервера (HKDF «univ-webpush-v1»), как у пропуска, Wi-Fi и календаря ────────────────────
const P256_N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"); // порядок группы P-256
type Vapid = { ecdh: ECDH; publicKey: Buffer; key: ReturnType<typeof createPrivateKey> };
let vapid: Vapid | null = null;

function vapidKeys(): Vapid {
  if (vapid) return vapid;
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (!secret) throw new Error("BETTER_AUTH_SECRET не задан");
  const ecdh = createECDH("prime256v1");
  // Скаляр должен быть в [1, n): вероятность промаха ~2⁻³², на этот случай — следующий счётчик.
  for (let i = 0; ; i++) {
    if (i > 8) throw new Error("не удалось вывести ключ VAPID");
    const d = Buffer.from(hkdfSync("sha256", secret, new Uint8Array(), `univ-webpush-v1:${i}`, 32));
    const k = BigInt(`0x${d.toString("hex")}`);
    if (k < BigInt(1) || k >= P256_N) continue;
    ecdh.setPrivateKey(d);
    break;
  }
  const publicKey = ecdh.getPublicKey();
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: b64u(ecdh.getPrivateKey()), x: b64u(publicKey.subarray(1, 33)), y: b64u(publicKey.subarray(33, 65)) },
    format: "jwk",
  });
  vapid = { ecdh, publicKey, key };
  return vapid;
}

/** Ключ сервера для `pushManager.subscribe({ applicationServerKey })`. */
export const vapidPublicKey = () => b64u(vapidKeys().publicKey);

/** VAPID-заголовок: JWT ES256 на origin службы, 12 часов. sub — адрес сайта (почты у проекта нет). */
export function vapidAuthorization(endpoint: string, now = Date.now()): string {
  const { key, publicKey } = vapidKeys();
  const sub = process.env.BETTER_AUTH_URL ?? "https://university-dekanat.duckdns.org";
  const part = (o: object) => b64u(Buffer.from(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub })}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${b64u(signature)}, k=${b64u(publicKey)}`;
}

// ─── Шифрование содержимого: RFC 8291, одна запись aes128gcm ─────────────────────────────────────────────────────────
const hkdf = (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) => Buffer.from(hkdfSync("sha256", ikm, salt, info, length));

/** Тело запроса к службе push. salt и ключ отправителя — для теста по вектору RFC 8291, иначе случайные. */
export function encryptPayload(plaintext: Buffer, ua: { p256dh: string; auth: string }, fixed?: { salt: Buffer; senderPrivateKey: Buffer }): Buffer {
  const uaPublic = fromB64u(ua.p256dh);
  const authSecret = fromB64u(ua.auth);
  const sender = createECDH("prime256v1");
  if (fixed) sender.setPrivateKey(fixed.senderPrivateKey);
  else sender.generateKeys();
  const asPublic = sender.getPublicKey();
  const salt = fixed?.salt ?? randomBytes(16);

  const ecdhSecret = sender.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url: string; tag: string };

// Apple просит не обновлять JWT чаще раза в час (ревью Codex 99): готовый заголовок — на час для каждой службы.
const authCache = new Map<string, { header: string; until: number }>();
function cachedAuthorization(endpoint: string, now = Date.now()) {
  const origin = new URL(endpoint).origin;
  const hit = authCache.get(origin);
  if (hit && hit.until > now) return hit.header;
  const header = vapidAuthorization(endpoint, now);
  authCache.set(origin, { header, until: now + 3600_000 });
  return header;
}

/** Отправить одно уведомление. Возвращает HTTP-статус службы или 0 (сеть, таймаут, адрес не прошёл проверку). */
export async function sendPush(target: PushTarget, message: PushMessage): Promise<number> {
  if (!isPushEndpoint(target.endpoint)) return 0;
  try {
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        TTL: "3600", // час: служба не держит сообщение долго — после выхода из кабинета оно не «догонит» устройство
        Urgency: "high",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Authorization: cachedAuthorization(target.endpoint),
      },
      body: new Uint8Array(encryptPayload(Buffer.from(JSON.stringify(message)), target)),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    await res.body?.cancel();
    return res.status;
  } catch {
    return 0;
  }
}
