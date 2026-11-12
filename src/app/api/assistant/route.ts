import { z } from "zod";
import { MAX_ANSWER_CHARS, sanitizeAnswer } from "@/lib/assistant/answer";
import { canonicalLink } from "@/lib/assistant/links";
import { buildMyContext } from "@/server/ai/context";
import { FIND_FREE_ROOMS, formatFreeRooms } from "@/server/ai/functions";
import { AssistantError, gigachatComplete, type ChatMessage } from "@/server/ai/gigachat";
import { findFreeRooms } from "@/server/dal/rooms";
import { takeStudentSlot, withProviderSlot } from "@/server/ai/limits";
import { systemPrompt } from "@/server/ai/prompt";
import { studentForApi } from "@/server/session";

// «Спросить по кабинету»: вопрос студента → снимок ЕГО кабинета → GigaChat → ответ со ссылками из снимка.
// План и ревью: docs/plans/assistant.md, docs/ai-log/codex/16-assistant-plan.md.

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 24 * 1024;
const TIMEOUT_MS = 25_000;

const Body = z.object({
  // Кому принадлежит диалог в браузере: после смены аккаунта старая история не уйдёт с новой сессией.
  owner: z.string().max(100),
  messages: z
    .array(
      z.discriminatedUnion("role", [
        z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(1000) }),
        z.object({ role: z.literal("assistant"), content: z.string().max(MAX_ANSWER_CHARS) }),
      ]),
    )
    .min(1)
    .max(12)
    .refine((m) => m.at(-1)?.role === "user", "Последней должна быть реплика студента"),
});

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

const errorText: Record<AssistantError["kind"], [number, string]> = {
  "not-configured": [503, "Помощник пока не подключён. Всё нужное есть в разделах кабинета."],
  busy: [503, "Помощник сейчас занят другими студентами. Попробуйте через минуту."],
  quota: [503, "У помощника закончился лимит запросов. Разделы кабинета работают как обычно."],
  unavailable: [502, "GigaChat не ответил. Попробуйте ещё раз чуть позже."],
};

/** Читает тело не больше лимита — до разбора JSON. */
async function readBody(req: Request): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Защита от CSRF: запрос только со своего сайта. Отсутствующий, `null` и чужой Origin отклоняются. */
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const site = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : new URL(req.url).origin;
  return origin !== null && origin === site;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(403, { error: "Запрос не с этого сайта." });
  const who = await studentForApi();
  if (!who.ok) return json(who.status, { error: who.status === 401 ? "Войдите в кабинет." : "Помощник доступен только студентам." });

  const raw = await readBody(req);
  if (raw === null) return json(413, { error: "Слишком длинный запрос." });
  let parsed;
  try {
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { error: "Неверный формат запроса." });
  }
  if (!parsed.success) return json(400, { error: "Вопрос пустой или слишком длинный (до 1000 символов)." });
  if (parsed.data.owner !== who.student.userId) return json(409, { error: "Вы вошли под другим аккаунтом. Начните новый разговор.", reset: true });

  const slot = takeStudentSlot(who.student.studentId);
  if (!slot.ok) {
    const text = { active: "Подождите, помощник ещё отвечает на прошлый вопрос.", minute: "Слишком часто: попробуйте через минуту.", day: "На сегодня лимит вопросов исчерпан (60)." };
    return json(429, { error: text[slot.reason] });
  }

  const started = Date.now();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  const onClientGone = () => abort.abort();
  if (req.signal.aborted) abort.abort();
  req.signal.addEventListener("abort", onClientGone, { once: true });
  try {
    const ctx = await buildMyContext();
    if (abort.signal.aborted) throw new AssistantError("unavailable", "aborted");
    const raw = await withProviderSlot(async () => {
      const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(ctx) }, ...parsed.data.messages];
      const opts = { maxTokens: 600, signal: abort.signal, functions: [FIND_FREE_ROOMS] };
      const reply = await gigachatComplete(messages, opts);
      // Функция только читает свободное время. Ответ по ней собирает сервер: модель путала интервалы при пересказе.
      if (reply.functionCall?.name === FIND_FREE_ROOMS.name) return formatFreeRooms(await findFreeRooms(reply.functionCall.arguments, ctx.asOf));
      return reply.content;
    }, abort.signal);
    const answer = sanitizeAnswer(raw, (href) => canonicalLink(href, ctx.links, ctx.asOf));
    console.info(`[assistant] ok ${Date.now() - started}ms`);
    return json(200, { answer: answer || "Не получилось сформулировать ответ. Попробуйте спросить иначе." });
  } catch (e) {
    const kind = e instanceof AssistantError ? e.kind : "unavailable";
    // В журнал — только вид ошибки, наш собственный код («chat 400») или имя класса и длительность:
    // без вопросов, снимка, ответа, текста ошибки провайдера и токенов.
    const code = e instanceof AssistantError ? e.message : e instanceof Error ? e.name : typeof e;
    console.warn(`[assistant] ${kind} (${code}) ${Date.now() - started}ms`);
    const [status, error] = errorText[kind];
    return json(status, { error });
  } finally {
    clearTimeout(timer);
    req.signal.removeEventListener("abort", onClientGone);
    slot.release();
  }
}
