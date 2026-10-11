# راهنمای Desktop Agent

نسخه فعلی Agent: **0.2.0** (فاز ۲)

## آنچه پیاده‌سازی شده

- ثبت دستگاه با ایمیل/رمز کاربر (`login`)
- شروع و پایان کار (`start-work` / `end-work`)
- Heartbeat پیش‌فرض هر ۶۰ ثانیه (`run`)
- تشخیص Idle و قفل صفحه در Linux/Windows (بهترین تلاش با APIهای در دسترس)
- صف آفلاین محلی SQLite و همگام‌سازی مجدد (`sync` / حلقه `run`)
- نمایش وضعیت اتصال و اندازه صف
- لغو دسترسی دستگاه از پنل وب/API

## آنچه Agent جمع‌آوری نمی‌کند

- اسکرین‌شات
- کلیدهای تایپ‌شده
- Clipboard
- صدا یا تصویر

## ساخت

پیش‌نیاز: Go 1.22+

```bash
cd apps/agent
make build-linux
make build-windows
# یا
make build-all
```

خروجی: `apps/agent/bin/`

## استفاده

```bash
# ثبت دستگاه
./bin/workpulse-agent-linux-amd64 login \
  -api http://localhost:4000/api \
  -email employee@example.com \
  -password '********' \
  -name "لپ‌تاپ کاری"

# اجرای پس‌زمینه
./bin/workpulse-agent-linux-amd64 run

# شروع / پایان کار
./bin/workpulse-agent-linux-amd64 start-work
./bin/workpulse-agent-linux-amd64 end-work

# وضعیت محلی
./bin/workpulse-agent-linux-amd64 status
```

تنظیمات در `~/.workpulse/config.json` و صف آفلاین در `~/.workpulse/offline-queue.db` ذخیره می‌شود.

## نکات پلتفرم

### Linux
- Idle: در صورت وجود `xprintidle`
- قفل صفحه: از طریق `loginctl LockedHint` در صورت دسترسی نشست
- بدون نیاز به root

### Windows
- Idle: `GetLastInputInfo`
- قفل صفحه: بررسی دسترسی به Input Desktop

اگر API سیستم‌عامل در دسترس نباشد، Agent همچنان کار می‌کند و مقدار Idle/Lock را ۰/false گزارش می‌کند.

## APIهای مرتبط

| مسیر | توضیح |
|------|--------|
| `POST /api/agent/register` | ثبت دستگاه |
| `POST /api/agent/work/start` | شروع کار |
| `POST /api/agent/work/end` | پایان کار |
| `POST /api/agent/heartbeat` | Heartbeat |
| `POST /api/agent/events/sync` | همگام‌سازی دسته‌ای |
| `GET /api/devices` | فهرست دستگاه‌ها |
| `POST /api/devices/:id/revoke` | لغو دستگاه |
| `GET /api/attendance/status` | وضعیت حضور |
| `GET /api/attendance/timeline` | تایم‌لاین |
