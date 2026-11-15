#!/usr/bin/env bash
# Резервная копия базы (docs/DEPLOY.md): сжатый SQL-дамп вне каталога проекта, хранится 7 дней.
# Запускает таймер deploy/dekanat-backup.timer каждые 6 часов; вручную: sudo /opt/dekanat/deploy/backup.sh
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
dir="${BACKUP_DIR:-/root/backups}"
keep_days="${BACKUP_KEEP_DAYS:-7}"
mkdir -p "$dir"
chmod 700 "$dir"

out="$dir/dekanat-$(date +%F-%H%M).sql.gz"
tmp="$out.partial"
trap 'rm -f "$tmp"' EXIT

# Сначала во временный файл: оборванный дамп не займёт место целой копии и не попадёт под ротацию.
docker compose exec -T db pg_dump -U dekanat dekanat | gzip -9 > "$tmp"
gzip -t "$tmp"
tail_lines="$(gunzip -c "$tmp" | tail -n 5)"
grep -q "PostgreSQL database dump complete" <<< "$tail_lines" || { echo "дамп не завершён" >&2; exit 1; }
mv "$tmp" "$out"

find "$dir" -maxdepth 1 -name 'dekanat-*.sql.gz' -mtime +"$keep_days" -delete
echo "ok $(basename "$out") $(du -h "$out" | cut -f1)"
