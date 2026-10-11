#!/usr/bin/env sh
set -eu

# بازگردانی پشتیبان PostgreSQL
# استفاده: ./infra/scripts/restore.sh مسیر/فایل.sql.gz
# هشدار: این عملیات داده‌های فعلی را بازنویسی می‌کند.

if [ "${1:-}" = "" ]; then
  echo "استفاده: $0 مسیر/فایل.sql.gz" >&2
  exit 1
fi

BACKUP_FILE=$1
ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "فایل پشتیبان یافت نشد: $BACKUP_FILE" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "خطا: فایل .env یافت نشد." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
. ./.env
set +a

echo "هشدار: داده‌های فعلی دیتابیس جایگزین می‌شوند."
echo "برای ادامه Enter بزنید یا Ctrl+C برای لغو..."
read -r _

gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres \
  psql -U "${POSTGRES_USER:-workpulse}" -d "${POSTGRES_DB:-workpulse}"

echo "بازگردانی انجام شد."
