import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Доступ к БД — только через серверный слой (src/server), где проверяются сессия и владелец.
    files: ["src/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    ignores: ["src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/db",
                "@/server/db.*",
                "**/server/db",
                "**/server/db.*",
                "@/generated/prisma",
                "@/generated/prisma/*",
                "**/generated/prisma",
                "**/generated/prisma/*",
              ],
              message: "Prisma напрямую — только в src/server. Используйте функции DAL с проверкой доступа.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
