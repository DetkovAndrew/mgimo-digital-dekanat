import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";

// Клиент GigaChat (Сбер). Ключ только из окружения сервера; в браузер и логи не попадает.
// Серверы GigaChat подписаны «Russian Trusted Root CA» Минцифры: доверие к нему добавляется
// только этому агенту, проверка сертификатов и имени сервера не отключается.

export type FunctionCall = { name: string; arguments: Record<string, unknown> };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; function_call?: FunctionCall; functions_state_id?: string }
  | { role: "function"; name: string; content: string };
export type ChatFunction = { name: string; description: string; parameters: Record<string, unknown> };
export type ChatReply = { content: string; functionCall?: FunctionCall; stateId?: string };

export class AssistantError extends Error {
  constructor(
    readonly kind: "not-configured" | "busy" | "quota" | "unavailable",
    message: string = kind,
  ) {
    super(message);
  }
}

const cfg = () => ({
  key: process.env.GIGACHAT_AUTH_KEY ?? "",
  scope: process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS",
  model: process.env.GIGACHAT_MODEL || "GigaChat-2",
  oauthUrl: process.env.GIGACHAT_OAUTH_URL || "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
  apiUrl: process.env.GIGACHAT_API_URL || "https://gigachat.devices.sberbank.ru/api/v1",
});

export const isAssistantConfigured = () => cfg().key.length > 0;

let agent: https.Agent | null = null;
function gigaAgent() {
  agent ??= new https.Agent({
    keepAlive: true,
    ca: [...tls.rootCertificates, readFileSync(path.join(process.cwd(), "certs/russian_trusted_root_ca.pem"), "utf8")],
  });
  return agent;
}

const MAX_RESPONSE_BYTES = 64 * 1024;

/** POST с отменой по сигналу: таймаут реально обрывает и соединение, и чтение ответа. */
function post(url: string, headers: Record<string, string>, body: string, signal: AbortSignal) {
  return new Promise<{ status: number; json: unknown }>((resolve, reject) => {
    if (signal.aborted) return reject(new AssistantError("unavailable", "aborted"));
    const req = https.request(url, { method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(body) }, agent: gigaAgent() }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > MAX_RESPONSE_BYTES) req.destroy(new AssistantError("unavailable", "response too large"));
        else chunks.push(c);
      });
      res.on("end", () => {
        let json: unknown = null;
        try {
          json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {}
        resolve({ status: res.statusCode ?? 0, json });
      });
      res.on("error", reject);
    });
    const abort = () => req.destroy(new AssistantError("unavailable", "timeout"));
    signal.addEventListener("abort", abort, { once: true });
    req.on("error", (e) => reject(e instanceof AssistantError ? e : new AssistantError("unavailable", "network")));
    req.on("close", () => signal.removeEventListener("abort", abort));
    req.end(body);
  });
}

// Один общий токен на процесс и одно обновление за раз.
let token: { value: string; expiresAt: number } | null = null;
let refreshing: Promise<string> | null = null;

async function getToken(signal: AbortSignal, force = false): Promise<string> {
  if (!force && token && token.expiresAt - 60_000 > Date.now()) return token.value;
  refreshing ??= (async () => {
    const { key, scope, oauthUrl } = cfg();
    if (!key) throw new AssistantError("not-configured");
    const res = await post(
      oauthUrl,
      { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", RqUID: randomUUID(), Authorization: `Basic ${key}` },
      new URLSearchParams({ scope }).toString(),
      signal,
    );
    const j = res.json as { access_token?: string; expires_at?: number } | null;
    if (res.status !== 200 || !j?.access_token || !j.expires_at) throw new AssistantError(res.status === 429 ? "busy" : "unavailable", `oauth ${res.status}`);
    // expires_at приходит в миллисекундах; на случай секунд — переводим.
    const expiresAt = j.expires_at < 1e12 ? j.expires_at * 1000 : j.expires_at;
    token = { value: j.access_token, expiresAt };
    return j.access_token;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Один ответ модели (текст или вызов функции). 401 → один повтор с новым токеном. */
export async function gigachatComplete(
  messages: ChatMessage[],
  { maxTokens, signal, functions }: { maxTokens: number; signal: AbortSignal; functions?: ChatFunction[] },
): Promise<ChatReply> {
  const { apiUrl, model } = cfg();
  const body = JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.2,
    stream: false,
    ...(functions?.length ? { functions, function_call: "auto" } : {}),
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const access = await getToken(signal, attempt > 0);
    const res = await post(`${apiUrl}/chat/completions`, { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${access}` }, body, signal);
    if (res.status === 401 && attempt === 0) {
      token = null;
      continue;
    }
    if (res.status === 429) throw new AssistantError("busy", "rate limited");
    if (res.status === 402) throw new AssistantError("quota", "payment required");
    const j = res.json as { choices?: { message?: { content?: string; function_call?: FunctionCall; functions_state_id?: string } }[] } | null;
    const m = j?.choices?.[0]?.message;
    if (res.status !== 200 || !m || typeof m.content !== "string") throw new AssistantError("unavailable", `chat ${res.status}`);
    const fc = m.function_call && typeof m.function_call.name === "string" && typeof m.function_call.arguments === "object" ? m.function_call : undefined;
    return { content: m.content, functionCall: fc, stateId: m.functions_state_id };
  }
  throw new AssistantError("unavailable", "auth");
}
