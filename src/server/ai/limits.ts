import "server-only";
import { AssistantError } from "./gigachat";

// Ограничения помощника. Счётчики в памяти процесса: прототип работает одним процессом Node
// (next start / standalone, см. docs/plans/assistant.md). При нескольких процессах их нужно вынести в PostgreSQL.

// 200 в сутки, а не 60: демо-аккаунт Алины общий у всех экспертов жюри, и суточная квота у них тоже одна на всех.
export const ASSISTANT_LIMITS = { perMinute: 10, perDay: 200, concurrency: Number(process.env.GIGACHAT_MAX_CONCURRENCY) || 1, queue: 8, waitMs: 20_000 };

const hits = new Map<string, number[]>();
const active = new Set<string>();

export type LimitVerdict = { ok: true; release: () => void } | { ok: false; reason: "active" | "minute" | "day" };

/** Квота студента: не больше одного запроса одновременно, 10 в минуту и 200 в сутки. */
export function takeStudentSlot(studentId: string, now = Date.now()): LimitVerdict {
  if (active.has(studentId)) return { ok: false, reason: "active" };
  const list = (hits.get(studentId) ?? []).filter((t) => now - t < 86_400_000);
  if (list.length >= ASSISTANT_LIMITS.perDay) return { ok: false, reason: "day" };
  if (list.filter((t) => now - t < 60_000).length >= ASSISTANT_LIMITS.perMinute) return { ok: false, reason: "minute" };
  list.push(now);
  hits.set(studentId, list);
  active.add(studentId);
  return { ok: true, release: () => active.delete(studentId) };
}

// Общий ограничитель параллельности: у тарифа физлица один поток на всех студентов.
let running = 0;
const waiting: (() => void)[] = [];

export async function withProviderSlot<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new AssistantError("unavailable", "aborted");
  if (running < ASSISTANT_LIMITS.concurrency) running++;
  else {
    // Ждём, пока освободившийся запрос передаст свой слот (running при передаче не меняется).
    if (waiting.length >= ASSISTANT_LIMITS.queue) throw new AssistantError("busy", "queue full");
    await new Promise<void>((resolve, reject) => {
      const go = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", give);
        resolve();
      };
      const give = () => {
        const i = waiting.indexOf(go);
        if (i >= 0) waiting.splice(i, 1);
        clearTimeout(timer);
        reject(new AssistantError("busy", "wait timeout"));
      };
      const timer = setTimeout(give, ASSISTANT_LIMITS.waitMs);
      signal.addEventListener("abort", give, { once: true });
      waiting.push(go);
    });
  }
  try {
    if (signal.aborted) throw new AssistantError("unavailable", "aborted");
    return await run();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

/** Только для тестов. */
export function resetAssistantLimits() {
  hits.clear();
  active.clear();
}
