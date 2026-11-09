import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

// Общие опции для веб-экземпляра (src/server/auth.ts) и CLI-экземпляра seed (prisma/seed.ts).
// Без `server-only`: этот файл импортируют seed и Better Auth CLI.
export const baseAuthOptions = {
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    additionalFields: {
      // input: false — роль нельзя передать во входных данных Better Auth.
      // Собственные обработчики не должны передавать в prisma.user.* поля из запроса.
      role: { type: "string", required: true, defaultValue: "student", input: false },
    },
  },
} satisfies BetterAuthOptions;
