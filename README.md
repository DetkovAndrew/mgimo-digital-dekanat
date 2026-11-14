# Цифровой деканат будущего

Прототип личного кабинета студента вымышленного университета **University** —
трек «Вайб-кодинг» конкурса [MGIMO AI Challenge 2026](https://challenge.mgimo.ai/).

> Концепт для конкурса MGIMO AI Challenge 2026. Не является официальным сервисом
> какого-либо вуза. Все данные вымышлены.

Next.js 16 · TypeScript · Tailwind 4 · PostgreSQL 18 (embedded-postgres) · Prisma 7 · Better Auth.

## Запуск

Команда использует Node.js 26 (проверено на 26.13); локальные проверки Codex 11.11 — Node.js 24.22.1.

```bash
cp .env.example .env        # заполнить: секрет Better Auth, пароль БД, пароли демо-аккаунтов
npm install
npm run db                  # PostgreSQL на 127.0.0.1, держать запущенным в отдельном терминале
npm run db:deploy           # миграции
npm run db:seed             # демо-данные: alina.lebedeva, timur.orlov, dekanat.fhb
npm run dev                 # http://127.0.0.1:3000
```

На Windows можно задать в `.env` `PG_DATA_DIR="C:/MGIMO/mgimo-digital-dekanat/.data/postgres"`,
чтобы локальная БД лежала в игнорируемом каталоге проекта. Скрипт выбирает совместимую локаль.
`typecheck` сначала генерирует типы маршрутов Next.js, поэтому работает и в свежем checkout.

Проверки: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`
(интеграционные тесты на отдельной БД `TEST_DATABASE_URL`, имя должно оканчиваться на `_test`).

На сервере: `docker compose up -d --build` (PostgreSQL, приложение и Caddy с HTTPS) — по шагам в
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Где читать дальше

- [`ТЗ_Вайбкодинг.txt`](ТЗ_Вайбкодинг.txt) — задание конкурса.
- [`AGENTS.md`](AGENTS.md) — правила проекта: безопасность, данные, интерфейс, команды. Обязательно к прочтению.
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — продукт и сценарии, [`docs/DECISIONS.md`](docs/DECISIONS.md) — принятые решения.
- [`docs/ai-log/JOURNAL.md`](docs/ai-log/JOURNAL.md) — журнал работы с ИИ (основа отчёта для жюри).
- [`docs/NURSU-HANDOFF.md`](docs/NURSU-HANDOFF.md) — готовые материалы NursuUwU и оставшиеся ручные действия.

`.env`, пароли и скриншоты исследования (`docs/research/screenshots/`) в репозиторий не попадают
и передаются внутри команды отдельно.
