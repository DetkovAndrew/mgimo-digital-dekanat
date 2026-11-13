/** Формат демо-пропуска. Здесь нет ключей, переменных окружения или данных студента. */
export const PASS_WINDOW_MS = 30_000;
export const PASS_PREFIX = "UNIV-PASS:v1:";
export const PASS_TOKEN_BYTES = 18;

export type PassCode = { payload: string; expiresAt: string };

export function isPassCode(value: unknown): value is PassCode {
  if (!value || typeof value !== "object") return false;
  const code = value as Record<string, unknown>;
  return (
    typeof code.payload === "string" &&
    /^UNIV-PASS:v1:[A-Za-z0-9_-]{24}$/.test(code.payload) &&
    typeof code.expiresAt === "string" &&
    Number.isFinite(Date.parse(code.expiresAt)) &&
    Date.parse(code.expiresAt) % PASS_WINDOW_MS === 0
  );
}
