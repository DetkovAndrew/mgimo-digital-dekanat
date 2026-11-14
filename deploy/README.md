# Развёртывание

Действующая схема — Docker Compose: PostgreSQL, приложение и Caddy с автоматическим HTTPS.
Инструкция по шагам — [`docs/DEPLOY.md`](../docs/DEPLOY.md), конфигурация — `compose.yaml`, `deploy/Caddyfile`,
шаблон переменных — `deploy/env.production.example`.

Конфигурации Nginx, подготовленные 11.11 в ветке NursuUwU до выбора сервера, заменены Caddy при слиянии 14.11
(DECISIONS, 13.11): Caddy сам получает и продлевает сертификат.

Статус на 14.11: сайт работает на сервере 82.114.226.193 по временному адресу `82-114-226-193.sslip.io`.
Целевой адрес — `university-dekanat.duckdns.org` (зарегистрирован NursuUwU 11.11): когда в DuckDNS будет указан этот
IP, адрес переключается одной строкой (docs/DEPLOY.md, «Смена домена»).
