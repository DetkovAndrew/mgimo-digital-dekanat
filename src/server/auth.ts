import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { baseAuthOptions } from "./auth-options";

export const auth = betterAuth({
  ...baseAuthOptions,
  emailAndPassword: {
    enabled: true,
    // Учётные записи выдаёт вуз (у нас — seed), самостоятельной регистрации нет.
    // Запрет действует и на серверный auth.api.signUpEmail.
    disableSignUp: true,
  },
  // Лимит действует на HTTP-эндпоинты Better Auth, поэтому вход идёт через
  // /api/auth/sign-in/username (клиент Better Auth), а не через прямой auth.api в Server Action.
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/username": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  // nextCookies должен быть последним: выставляет cookies из Server Actions.
  plugins: [username(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
