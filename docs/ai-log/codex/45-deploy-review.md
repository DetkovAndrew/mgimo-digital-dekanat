- **P1 — пароль БД может сломать первый запуск.** [compose.yaml:25](/home/acid/projects/MGIMO/compose.yaml:25): пароль вставляется в URL без кодирования, а [инструкция:39](/home/acid/projects/MGIMO/docs/DEPLOY.md:39) предлагает base64, содержащий `/`. Проверил через `pg-connection-string`: такой URL отвергается. Использовать `openssl rand -hex 24` либо кодировать пароль при сборке URL. Исправить все три `DATABASE_URL`.

- **P2 — резервная копия попадёт в образ tools.** [DEPLOY.md:76](/home/acid/projects/MGIMO/docs/DEPLOY.md:76) создаёт `backup-*.sql` внутри контекста; [Dockerfile:15](/home/acid/projects/MGIMO/Dockerfile:15) копирует его целиком. Дамп содержит в том числе токены сессий. Добавить `backup-*.sql`, каталог резервных копий и `.data` в `.dockerignore`, хранить копии вне проекта. SQL миграций исключать нельзя. [Правила Docker](https://docs.docker.com/build/concepts/context/#dockerignore-files).

- **P2 — команда восстановления небезопасна для заполненной БД.** [DEPLOY.md:77](/home/acid/projects/MGIMO/docs/DEPLOY.md:77): обычный dump поверх существующих таблиц даст ошибки и частичное выполнение; `psql` по умолчанию продолжает обработку. Описать восстановление в пустую БД при остановленном приложении и добавить `-v ON_ERROR_STOP=1`. [Документация PostgreSQL](https://www.postgresql.org/docs/current/app-psql.html).

- **P3 — случайный отладочный файл в staged.** [.q.cjs:1](/home/acid/projects/MGIMO/.q.cjs:1) — одноразовый запрос к БД; убрать из поставки.

Том PG18 настроен правильно; ошибок в HOSTNAME, Origin и передаче IP не нашёл: Caddy очищает входящие forwarded-заголовки, Better Auth читает X-Forwarded-For. [PostgreSQL image](https://hub.docker.com/_/postgres), [Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults).

В остальных перечисленных изменениях существенных замечаний нет. Docker-сборку и доступность из РФ не проверял.