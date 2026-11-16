import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { auth } from "@/server/auth";
import { AUTH_BASE_PATH, PUBLIC_AUTH_PATHS } from "@/server/auth-paths";

// Обработчик /api/auth на тестовой БД с демо-данными: наружу только вход, выход и сессия, лимит входа — по адресу.

const BASE = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
const call = (method: "GET" | "POST", path: string, ip: string, opts: { body?: unknown; cookie?: string } = {}) => {
  const req = new Request(`${BASE}${AUTH_BASE_PATH}${path}`, {
    method,
    headers: {
      Origin: BASE,
      "x-forwarded-for": ip,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
  });
  return method === "GET" ? GET(req) : POST(req);
};
const cookieOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const password = () => {
  const p = process.env.SEED_PASSWORD_STUDENT_A;
  if (!p) throw new Error("SEED_PASSWORD_STUDENT_A не задан");
  return p;
};

describe("эндпоинты Better Auth наружу", () => {
  const endpoints = Object.values(auth.api as Record<string, { path?: string; options?: { method?: string | string[] } }>)
    .filter((e) => e.path)
    .map((e) => ({ path: e.path!, methods: [e.options?.method ?? "POST"].flat().filter((m) => m === "GET" || m === "POST") as ("GET" | "POST")[] }));

  it("все открытые пути существуют в Better Auth", () => {
    const known = new Set(endpoints.map((e) => e.path));
    for (const p of PUBLIC_AUTH_PATHS) expect(known, p).toContain(p);
  });

  it("остальные эндпоинты отвечают 404, в том числе новые после обновления", async () => {
    const closed = endpoints.filter((e) => !PUBLIC_AUTH_PATHS.has(e.path));
    expect(closed.map((e) => e.path)).toEqual(expect.arrayContaining(["/change-password", "/update-user", "/revoke-sessions", "/sign-in/email"]));
    for (const e of closed) {
      const path = e.path.replace(/:\w+/g, "x");
      for (const m of e.methods) expect((await call(m, path, "198.51.100.1")).status, `${m} ${e.path}`).toBe(404);
    }
  });

  it("вошедший студент не может сменить пароль, логин и чужие сессии", async () => {
    const ip = "198.51.100.2";
    const login = await call("POST", "/sign-in/username", ip, { body: { username: "alina.lebedeva", password: password() } });
    expect(login.status).toBe(200);
    const cookie = cookieOf(login);

    expect((await call("POST", "/change-password", ip, { cookie, body: { currentPassword: password(), newPassword: "Zz9-new-password" } })).status).toBe(404);
    expect((await call("POST", "/update-user", ip, { cookie, body: { username: "hacked.user", name: "X" } })).status).toBe(404);
    expect((await call("POST", "/revoke-sessions", ip, { cookie })).status).toBe(404);

    const session = await call("GET", "/get-session", ip, { cookie });
    expect(session.status).toBe(200);
    expect((await session.json()).user.username).toBe("alina.lebedeva");

    // Пароль прежний: следующий эксперт войдёт тем же.
    expect((await call("POST", "/sign-in/username", ip, { body: { username: "alina.lebedeva", password: password() } })).status).toBe(200);
    expect((await call("POST", "/sign-out", ip, { cookie })).status).toBe(200);
  });

  it("лимит входа: 10 попыток в минуту с одного адреса, другой адрес не задет", async () => {
    const ip = "198.51.100.3";
    const wrong = () => call("POST", "/sign-in/username", ip, { body: { username: "alina.lebedeva", password: "wrong-password-1" } });
    for (let i = 0; i < 10; i++) expect((await wrong()).status).toBe(401);
    expect((await wrong()).status).toBe(429);
    expect((await call("POST", "/sign-in/username", "198.51.100.4", { body: { username: "alina.lebedeva", password: password() } })).status).toBe(200);
  });
});
