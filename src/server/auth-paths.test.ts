import { describe, expect, it } from "vitest";
import { isPublicAuthPath } from "./auth-paths";

describe("открытые эндпоинты Better Auth", () => {
  it("вход по логину, выход и проверка сессии открыты", () => {
    for (const p of ["/api/auth/sign-in/username", "/api/auth/sign-out", "/api/auth/get-session"]) expect(isPublicAuthPath(p)).toBe(true);
  });

  it("управление аккаунтом закрыто", () => {
    for (const p of [
      "/api/auth/change-password",
      "/api/auth/update-user",
      "/api/auth/revoke-sessions",
      "/api/auth/list-sessions",
      "/api/auth/sign-up/email",
      "/api/auth/sign-in/email",
      "/api/auth/reset-password/abc",
      "/api/auth/callback/github",
    ]) expect(isPublicAuthPath(p)).toBe(false);
  });

  it("обходные написания пути не проходят", () => {
    for (const p of [
      "/api/auth/sign-out/",
      "/api/auth//sign-out",
      "/api/auth/sign%2Dout",
      "/api/auth/SIGN-OUT",
      "/api/auth",
      "/api/auth/",
      "/sign-out",
      "/api/authx/sign-out",
    ]) expect(isPublicAuthPath(p)).toBe(false);
  });
});
