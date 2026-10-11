# امنیت و حریم خصوصی

## اصول

1. هیچ Secret واقعی در مخزن کد نیست؛ از `.env` استفاده کنید.
2. رمز عبور با bcrypt هش می‌شود.
3. دسترسی‌ها در Backend با Guard مجوز/نقش اعمال می‌شوند.
4. داده‌های سازمان‌ها با فیلتر `organizationId` ایزوله هستند.
5. توکن نشست و توکن دستگاه قابل لغو هستند.
6. فیلدهای حساس در Audit Log سانسور می‌شوند.
7. توکن GitLab با AES-256-GCM رمزگذاری و فقط سمت سرور نگهداری می‌شود.
8. Webhook GitLab در صورت تنظیم `GITLAB_WEBHOOK_SECRET` اعتبارسنجی می‌شود.

## داده‌های Agent

Agent **نباید** اسکرین‌شات، کلیدهای تایپ‌شده، Clipboard، صدا یا تصویر ضبط کند.

داده‌های مجاز:

- رویداد شروع/پایان کار
- Heartbeat و وضعیت اتصال
- Idle و قفل صفحه (در OSهای پشتیبانی‌شده)
- نسخه Agent و شناسه دستگاه

## سخت‌سازی HTTP

- CORS محدود به `CORS_ORIGINS`
- Rate limiting
- هدرهای `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- ValidationPipe با whitelist

## توصیه‌های Production

جزئیات: [PRODUCTION.md](PRODUCTION.md)
