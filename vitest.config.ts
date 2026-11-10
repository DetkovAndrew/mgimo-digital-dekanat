import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Интеграционные тесты (tests/integration) — отдельной командой `npm run test:db`.
  test: { include: ["src/**/*.test.ts", "tests/**/*.test.ts"], exclude: ["tests/integration/**", "node_modules/**"] },
});
