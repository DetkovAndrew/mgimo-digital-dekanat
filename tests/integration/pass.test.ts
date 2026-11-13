import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/pass/route";
import { createPassCode } from "@/server/pass/token";
import * as session from "@/server/session";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));
// После проверки сессии API ничего не читает из БД: проверяем настоящий маршрут + HMAC с двумя контекстами A/B.
vi.mock("@/server/db", () => ({ prisma: {} }));

const secret = "public-integration-fixture-pass-secret";
const now = Date.parse("2026-11-12T07:15:05.000Z");
const request = (owner?: string) => new Request("http://localhost/api/pass", { headers: owner ? { "X-Pass-Owner": owner } : {} });
const A: session.StudentContext = { userId: "pass-user-a", studentId: "pass-student-a", groupId: "pass-group-a" };
const B: session.StudentContext = { userId: "pass-user-b", studentId: "pass-student-b", groupId: "pass-group-b" };
function as(student: session.StudentContext) {
  vi.mocked(session.studentForApi).mockResolvedValue({ ok: true, student });
  return student;
}

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", secret);
  vi.spyOn(Date, "now").mockReturnValue(now);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("электронный демо-пропуск: доступ A/B", () => {
  it("A → B → A: код только из своей сессии, данные профиля в QR не попадают", async () => {
    const results: string[] = [];
    for (const student of [A, B, A]) {
      const who = as(student);
      const res = await GET(request(who.userId));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-pass-time")).toBe(String(now));
      expect(body).toEqual(createPassCode(who.studentId, secret, now));
      expect(Object.keys(body).sort()).toEqual(["expiresAt", "payload"]);
      expect(body.payload).not.toContain(who.studentId);
      results.push(body.payload);
    }
    expect(results[0]).not.toBe(results[1]);
    expect(results[0]).toBe(results[2]);
    // Заголовок владельца — дополнительная защита клиента; обычный GET только с сессией тоже работает.
    expect(await (await GET(request())).json()).toEqual(createPassCode(A.studentId, secret, now));
  });

  it.each([401, 403] as const)("без студенческой сессии — JSON %s без кеша и кода", async (status) => {
    vi.mocked(session.studentForApi).mockResolvedValue({ ok: false, status });
    const res = await GET(request());
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it("смена аккаунта под открытой страницей не подмешивает код B к профилю A", async () => {
    const a = as(A);
    as(B);
    const res = await GET(request(a.userId));
    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it("без серверного секрета — безопасная ошибка, тоже no-store", async () => {
    as(A);
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ error: "Демо-пропуск временно недоступен." });
  });
});
