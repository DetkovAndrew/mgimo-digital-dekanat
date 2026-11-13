# Цифровой деканат: сборка для сервера (docs/DEPLOY.md). Три стадии:
#   build  — зависимости и `next build` (standalone);
#   tools  — та же среда с prisma и tsx: миграции, демо-данные, аудитории со схем;
#   runner — только .next/standalone (без исходников и dev-зависимостей), процесс node от непривилегированного пользователя.
FROM node:26-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Движку миграций Prisma нужен OpenSSL (по нему же выбирается сборка движка при установке).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Для `prisma generate` и сборки нужен адрес БД, но подключения нет: сборка не ходит в базу.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# Better Auth проверяет секрет уже при сборке (сбор данных страниц). Временное значение — только на этот шаг:
# в слой ENV образа оно не попадает, на сервере секрет берётся из .env.
RUN BETTER_AUTH_SECRET="build-only-$(head -c 24 /dev/urandom | base64)" BETTER_AUTH_URL="http://localhost:3000" npm run build
# server.js раздаёт статику сам, если положить её рядом; пустая public в git не попадает — создаём.
RUN mkdir -p public && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/

FROM build AS tools
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:26-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
# Один процесс Node: лимиты помощника и брони хранятся в памяти (AGENTS.md).
CMD ["node", "server.js"]
