import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Кабинет почти целиком состоит из личных данных: рендерим на каждый запрос,
  // без Cache Components/PPR, чтобы персональное не попадало в общий кеш (AGENTS.md).
  cacheComponents: false,
  poweredByHeader: false,
  // Сборка для Docker: .next/standalone с минимальным server.js и нужными файлами node_modules (docs/DEPLOY.md).
  output: "standalone",
  // Файлы, которые читаются с диска во время запроса, — трассировка их не видит: сертификат Минцифры для TLS
  // к GigaChat и шрифт PDF-справки (src/server/documents/pdf.ts).
  outputFileTracingIncludes: {
    "/api/assistant": ["./certs/russian_trusted_root_ca.pem"],
    "/api/requests/[id]/document": ["./assets/fonts/onest/*.ttf"],
  },
  // Токен справки в адресе страницы проверки не уходит на другие сайты; Caddy ставит свою политику только по умолчанию.
  async headers() {
    return [{ source: "/verify/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
  // Значок разработчика Next перекрывал нижнее меню на телефоне; ошибки сборки показываются и без него.
  devIndicators: false,
  // Самое большое тело — фото профиля (до 200 КиБ после сжатия в браузере) плюс разметка multipart.
  experimental: { serverActions: { bodySizeLimit: "256kb" } },
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
