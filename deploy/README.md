# Развёртывание

Действующая схема — Docker Compose: PostgreSQL, приложение и Caddy с автоматическим HTTPS.
Инструкция по шагам — [`docs/DEPLOY.md`](../docs/DEPLOY.md), конфигурация — `compose.yaml`, `deploy/Caddyfile`,
шаблон переменных — `deploy/env.production.example`.

Конфигурации Nginx, подготовленные 11.11 в ветке NursuUwU до выбора сервера, заменены Caddy при слиянии 14.11
(DECISIONS, 13.11): Caddy сам получает и продлевает сертификат.

Статус на 14.11: сайт работает на сервере 82.114.226.193 по адресу **https://university-dekanat.duckdns.org**
(домен зарегистрировала NursuUwU 11.11, IP указан 14.11; сертификат Let's Encrypt выдаёт и продлевает Caddy).
Временный адрес `82-114-226-193.sslip.io` больше не обслуживается.
