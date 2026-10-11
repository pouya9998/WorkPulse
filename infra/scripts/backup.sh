#!/usr/bin/env sh
set -eu

# پشتیبان‌گیری از PostgreSQL داخل Docker Compose
# استفاده: ./infra/scripts/backup.sh [مسیر_خروجی]

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "خطا: فایل .env یافت نشد. ابتدا .env.example را کپی کنید." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
. ./.env
set +a

OUT_DIR=${1:-"$ROOT_DIR/backups"}
mkdir -p "$OUT_DIR"
STAMP=$(date -u +"%Y%m%dT%H%M%SZ")
OUT_FILE="$OUT_DIR/workpulse-$STAMP.sql.gz"

echo "در حال تهیه پشتیبان..."
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-workpulse}" -d "${POSTGRES_DB:-workpulse}" --clean --if-exists \
  | gzip > "$OUT_FILE"

echo "پشتیبان ذخیره شد: $OUT_FILE"
