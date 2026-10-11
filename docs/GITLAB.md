# راهنمای اتصال GitLab

وضعیت: **پیاده‌سازی‌شده (فاز ۵)**

## پیکربندی

1. در `.env` مقدار `ENCRYPTION_KEY` (ترجیحاً ۳۲+ کاراکتر) و در صورت نیاز `GITLAB_WEBHOOK_SECRET` را تنظیم کنید.
2. از پنل **GitLab** (`/gitlab`) یا API:
   - `POST /api/gitlab/connection` — Base URL و Personal Access Token
   - `POST /api/gitlab/projects/connect` — انتخاب پروژه‌های فعال برای Webhook
   - `POST /api/gitlab/mappings` — نگاشت صریح `userId` ↔ `gitlabUserId` / `gitlabUsername`
3. Webhook در GitLab:
   - URL: `https://<api-host>/api/gitlab/webhooks?organizationId=<org-id>`
   - Secret Token: همان `GITLAB_WEBHOOK_SECRET`
   - هدرها: `X-Gitlab-Token`, `X-Gitlab-Delivery`, `X-Gitlab-Event`

## همگام‌سازی

- `POST /api/gitlab/sync` — فهرست پروژه‌ها از API GitLab با صفحه‌بندی و تأخیر بین صفحات (Mock در تست e2e).

## گزارش فعالیت مهندسی

- `GET /api/gitlab/engineering/activity?from=&to=&userId=` (اختیاری)
- **تعداد Commit به‌تنهایی معیار بهره‌وری نیست**؛ پاسخ شامل `disclaimerFa` و `dataIncompletenessNotesFa` است.

## محدودیت‌های فعلی

- Review روی MR فقط در صورت ارسال رویداد مناسب از GitLab ثبت می‌شود؛ همگام‌سازی تاریخچه MR/Review از API هنوز stub است.
- Push Hook فقط شمارنده آماری commit در `EngineeringMetric` را به‌روز می‌کند (بدون امتیازدهی).
- اتصال واقعی به GitLab.com/Self-hosted به شبکه و توکن معتبر وابسته است.
