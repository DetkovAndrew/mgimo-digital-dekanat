# Развёртывание на сервере

Один сервер, Docker Compose: PostgreSQL 18, приложение (Next.js standalone, один процесс Node) и Caddy, который
сам получает и продлевает сертификат HTTPS для домена. Наружу открыты только 80 и 443; база и порт 3000 —
во внутренней сети Docker.

```
браузер ──HTTPS──> caddy:443 ──> app:3000 ──> db:5432 (том pgdata)
                                  │
                                  └──HTTPS (сертификат Минцифры)──> GigaChat
```

## Что нужно

- VPS с публичным IPv4, x86-64, Ubuntu 22.04/24.04 или Debian 12/13 (проверено 14.11 на Ubuntu 22.04:
  пакеты `docker.io` 29.1 и `docker-compose-v2` 2.40). Хостинг с хорошей связностью из РФ:
  жюри открывает сайт без VPN, с домашнего и мобильного интернета.
- 1 vCPU, 2 ГБ RAM, 15 ГБ диска. Замер 13.11: сборка на одном ядре — 82 с и до ~1,8 ГБ памяти в пике
  (на ядре VPS дольше); работающий сайт — Node ~90 МБ, страницы отвечают за 25–45 мс. Узкое место — память
  при сборке, а не ядра. С 1 ГБ RAM тоже можно, но только со swap (шаг 2), и сборка будет заметно дольше.
- Домен: A-запись на IP сервера. AAAA не создавайте, если IPv6 на сервере не настроен,
  иначе Let's Encrypt может не выдать сертификат.

## Первый запуск

1. **Docker и git** (пакеты Ubuntu, без внешних репозиториев):
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
   ```
2. **Swap**, если памяти меньше 4 ГБ:
   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
3. **Код.** Репозиторий пока приватный, поэтому код приезжает архивом коммита с машины разработчика —
   токен GitHub на сервер не кладём:
   ```bash
   git archive --format=tar HEAD | ssh root@СЕРВЕР 'mkdir -p /opt/dekanat && tar -x -C /opt/dekanat'
   ```
   Когда репозиторий станет открытым: `git clone https://github.com/DetkovAndrew/mgimo-digital-dekanat.git /opt/dekanat`.
4. **Переменные окружения** — файл `.env` рядом с `compose.yaml`, в git не попадает:
   ```bash
   cp deploy/env.production.example .env && chmod 600 .env
   openssl rand -hex 24      # → POSTGRES_PASSWORD (только hex: пароль вставляется в адрес БД без кодирования)
   openssl rand -base64 32   # → BETTER_AUTH_SECRET
   nano .env                 # DOMAIN, пароли демо-аккаунтов, ключ GigaChat
   ```
5. **Сборка и запуск** (первый раз 5–10 минут):
   ```bash
   sudo docker compose up -d --build
   ```
   Порядок: `db` → `migrate` (применяет миграции и завершается) → `app` → `caddy`.
6. **Демо-данные.** Команда **стирает все данные** и создаёт студентов, сотрудника, расписание, оценки, заявки
   и демо-брони. Запускать при первом развёртывании и перед показом жюри (оценки ставятся по прошедшим датам):
   ```bash
   sudo docker compose run --rm -e SEED_ALLOW_RESET=1 tools npm run db:seed
   ```
7. **Проверка:**
   ```bash
   sudo docker compose ps                 # app и db — healthy
   curl -s https://ДОМЕН/api/health       # {"ok":true}
   sudo docker compose logs -f app caddy  # сертификат получен, ошибок нет
   ```
   Затем сценарий жюри с телефона: войти → расписание → оценки → подать заявку → статус → выйти и войти снова.

## Обновление

```bash
git archive --format=tar HEAD | ssh root@СЕРВЕР 'tar -x -C /opt/dekanat'   # или git pull в открытом репозитории
ssh root@СЕРВЕР 'cd /opt/dekanat && docker compose up -d --build'
```

Пока приложение перезапускается, Caddy показывает страницу «Уже чиним» (`deploy/errors/down.html`, собирается
`npm run down-page`); она сама откроет сайт, когда `/api/health` ответит. После правки `Caddyfile` —
`docker compose up -d --force-recreate caddy`.

## Смена домена

Сейчас: `university-dekanat.duckdns.org` (DuckDNS, A-запись на IP сервера). Без своего домена можно временно работать
на `IP-через-дефисы.sslip.io` (публичный DNS отвечает IP из имени, Caddy
получает на это имя настоящий сертификат). Для своего домена: A-запись на IP сервера, затем в `.env` на сервере
`DOMAIN="новый.домен"` и `docker compose up -d` — пересоздаются `app` (новый `BETTER_AUTH_URL`) и `caddy`
(новый сертификат). Вошедшим пользователям придётся войти заново: cookies привязаны к домену.

Миграции применяются автоматически (`migrate`), данные остаются. Аудитории со схем после изменения
`src/lib/campus/plans.ts` переносятся без стирания: `sudo docker compose run --rm tools npm run db:rooms`.

Действия общего аккаунта сотрудника (переносы и отмены пар, объявления) откатываются без seed — заявки, справки, брони
и сессии остаются: `sudo docker compose run --rm tools npm run db:undo-staff` (сначала можно `-- --dry-run`).
Перед показом жюри и при сдаче — после него.

## Данные и перезапуск

- База лежит в томе `pgdata` и переживает `restart`, `down`, `up --build` и перезагрузку сервера
  (`restart: unless-stopped`). Стирает её только `docker compose down -v` — не запускайте.
- Резервные копии — `deploy/backup.sh`: сжатый дамп в `/root/backups` (**вне каталога проекта**: дамп содержит сессии,
  а всё в каталоге проекта уходит в контекст сборки), каждые 6 часов, хранятся 7 дней. Скрипт проверяет архив
  и завершённость дампа; оборванный дамп не сохраняется. Установка таймера (один раз, после выкладки кода):
  ```bash
  sudo cp /opt/dekanat/deploy/dekanat-backup.{service,timer} /etc/systemd/system/
  sudo systemctl daemon-reload && sudo systemctl enable --now dekanat-backup.timer
  sudo systemctl start dekanat-backup.service   # первая копия сразу
  systemctl list-timers dekanat-backup.timer; journalctl -u dekanat-backup.service -n 5
  ```
  Копии лежат на том же сервере и не спасут при потере самой ВМ: перед важным моментом (сдача, показ)
  скачайте свежую: `scp root@СЕРВЕР:/root/backups/dekanat-ДАТА.sql.gz .` (файл с сессиями — не в репозиторий).
- Восстановление — в пустую базу при остановленном приложении. Цепочка `&&` обрывается на первой ошибке:
  приложение не запустится на частично восстановленной базе.
  ```bash
  DUMP=/root/backups/dekanat-ДАТА.sql.gz
  test -s "$DUMP" && gzip -t "$DUMP" \
    && sudo docker compose stop app \
    && sudo docker compose exec -T db psql -U dekanat -d postgres -c 'DROP DATABASE dekanat WITH (FORCE)' -c 'CREATE DATABASE dekanat OWNER dekanat' \
    && gunzip -c "$DUMP" | sudo docker compose exec -T db psql -v ON_ERROR_STOP=1 -U dekanat dekanat \
    && sudo docker compose start app
  ```
  Если цепочка оборвалась, приложение остаётся остановленным: разберитесь с ошибкой и повторите.

## Безопасность

- Секреты только в `.env` на сервере (права 600). В репозитории — шаблон `deploy/env.production.example` без значений.
- Порты 5432 и 3000 не публикуются. Межсетевой экран: `sudo ufw allow 22,80,443/tcp && sudo ufw allow 443/udp && sudo ufw enable`.
- Приложение в контейнере работает от пользователя `node`, без исходников и dev-зависимостей.
- Caddy добавляет HSTS, `nosniff`, запрет встраивания во фреймы и `noindex`: концепт не попадает в поиск.
- Реплики `app` не добавлять: лимиты помощника и брони считаются в памяти одного процесса Node.
- Ключ GigaChat после конкурса перевыпустить.

## Если что-то не так

| Симптом | Что проверить |
|---|---|
| `docker compose up` не скачивает образы | Docker Hub бывает недоступен из РФ. Зеркало: в `/etc/docker/daemon.json` `{"registry-mirrors": ["https://mirror.gcr.io"]}`, затем `sudo systemctl restart docker` |
| Сборка не скачивает шрифт Onest | `next/font` при сборке берёт файлы с fonts.gstatic.com и кладёт в образ (в браузер они идут с нашего домена). Нужен доступ сервера к Google Fonts во время сборки |
| Сборка падает с `Killed` | Не хватает памяти — добавьте swap (шаг 2) |
| Caddy не получает сертификат | A-запись указывает на сервер, порты 80 и 443 открыты у хостинга и в ufw, нет лишней AAAA |
| Вход не работает, `403` | `DOMAIN` в `.env` совпадает с адресом в браузере (от него зависит `BETTER_AUTH_URL` и проверка Origin) |
| Помощник отвечает «недоступен» | `GIGACHAT_AUTH_KEY` и `GIGACHAT_SCOPE` в `.env`; `docker compose logs app` |
