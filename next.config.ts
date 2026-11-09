import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Кабинет почти целиком состоит из личных данных: рендерим на каждый запрос,
  // без Cache Components/PPR, чтобы персональное не попадало в общий кеш (AGENTS.md).
  cacheComponents: false,
  poweredByHeader: false,
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
