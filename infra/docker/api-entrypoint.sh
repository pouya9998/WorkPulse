#!/bin/sh
set -e

echo "[workpulse-api] در حال اعمال Migrationها..."
npx prisma migrate deploy

echo "[workpulse-api] راه‌اندازی API..."
exec node dist/main.js
