# راهنمای Production

## پیش از استقرار

1. `.env` را از `.env.example` بسازید و همه Secretها را عوض کنید:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET` (حداقل ۳۲ کاراکتر تصادفی)
   - `ENCRYPTION_KEY` (حداقل ۳۲ کاراکتر؛ برای توکن GitLab)
   - `BOOTSTRAP_ADMIN_PASSWORD`
   - در صورت نیاز `GITLAB_WEBHOOK_SECRET`
2. `CORS_ORIGINS` را فقط به دامنه پنل محدود کنید.
3. پورت PostgreSQL را به اینترنت باز نکنید (در compose فقط برای توسعه expose شده).
4. جلوی سرویس‌ها Reverse Proxy با HTTPS بگذارید (Caddy/Nginx).
5. پس از اولین ورود، رمز مدیر Bootstrap را عوض کنید.

## استقرار

```bash
cp .env.example .env
# ویرایش Secretها
docker compose up -d --build
docker compose ps
curl https://your-api.example/api/health
```

Migration هنگام استارت API با `prisma migrate deploy` اعمال می‌شود.

## پشتیبان‌گیری

```bash
./infra/scripts/backup.sh
./infra/scripts/restore.sh backups/workpulse-....sql.gz
```

هشدار: `docker compose down -v` Volume و داده‌ها را حذف می‌کند.

## مانیتورینگ حداقل

- Healthcheck کانتینرها
- لاگ: `docker compose logs -f api`
- بررسی دوره‌ای `/api/reports/overview` توسط مدیر

## سخت‌سازی انجام‌شده در کد

- Hash رمز با bcrypt
- JWT + نشست قابل لغو
- RBAC در Backend
- Rate limiting
- CORS محدود
- هدرهای امنیتی پایه
- Audit log با سانسور فیلدهای حساس
- رمزنگاری توکن GitLab سمت سرور
- اعتبارسنجی Webhook GitLab (در صورت تنظیم secret)
