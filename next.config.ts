import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Кабинет почти целиком состоит из личных данных: рендерим на каждый запрос,
  // без Cache Components/PPR, чтобы персональное не попадало в общий кеш (AGENTS.md).
  cacheComponents: false,
  poweredByHeader: false,
  // Проект лежит на диске C: (DrvFS в WSL): события файловой системы туда не доходят,
  // и Fast Refresh не видит правок. Опрос — крайняя мера, включается только локально через .env.
  ...(process.env.NEXT_WATCH_POLL_MS ? { watchOptions: { pollIntervalMs: Number(process.env.NEXT_WATCH_POLL_MS) } } : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
