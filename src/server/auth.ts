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
  // 10 попыток в минуту с одного адреса: эксперт входит по очереди тремя аккаунтами и может ошибиться
  // в пароле, несколько экспертов могут сидеть за одним NAT, а перебор паролей всё равно медленный.
  // По HTTP открыт только вход по логину (src/server/auth-paths.ts); правило для email — на случай, если его откроют.
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/username": { window: 60, max: 10 },
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  // nextCookies должен быть последним: выставляет cookies из Server Actions.
  plugins: [username(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
