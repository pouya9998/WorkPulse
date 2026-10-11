# وضعیت پیاده‌سازی WorkPulse

آخرین به‌روزرسانی: ۱۴۰۵/۰۷/۱۹ (۲۰۲۶-۱۰-۱۱)

## خلاصه فازها

| فاز | موضوع | وضعیت |
|-----|--------|--------|
| ۱ | ساختار، Docker، Auth، نقش‌ها، کاربران، UI فارسی | **پیاده‌سازی‌شده** |
| ۲ | Go Agent، دستگاه، Heartbeat، Idle، صف آفلاین | **پیاده‌سازی‌شده** |
| ۳ | سیاست حضور، اصلاح، هشدار، اعلان | **پیاده‌سازی‌شده** |
| ۴ | جلسات و Adapter تقویم | **پیاده‌سازی‌شده** (OAuth stub) |
| ۵ | GitLab webhook/sync/گزارش مهندسی | **پیاده‌سازی‌شده** (sync محدود) |
| ۶ | قرارداد نسخه‌بندی‌شده و حقوق پیشنهادی | **پیاده‌سازی‌شده** |
| ۷ | گزارش، تنظیمات، سخت‌سازی، مستندات Production | **پیاده‌سازی‌شده** |

## فاز ۲

- [x] RegisteredDevice + توکن دستگاه (hash)
- [x] WorkSession / AttendanceEvent / Heartbeat / DeviceStateInterval
- [x] API: register, start/end work, heartbeat, events/sync, devices revoke
- [x] Go Agent 0.2.0: login, run, start/end, offline SQLite queue, idle/lock best-effort
- [x] UI: `/attendance`, `/devices`
- [x] تست e2e: `test/attendance.e2e-spec.ts`

**محدودیت:** Idle/Lock روی لینوکس وابسته به `xprintidle`/`loginctl` است.

## فاز ۳

- [x] AttendancePolicy، AttendanceCorrection، Alert، Notification
- [x] موتور هشدار + dedupe + scheduler
- [x] UI: `/alerts`, `/corrections`, `/policies`, `/notifications`
- [x] تست: `alerts-engine.service.spec.ts`, `phase3.e2e-spec.ts`

**محدودیت:** اعلان فقط درون‌پنلی؛ Break/Unresolved پر شدن خودکار کامل نیست.

## فاز ۴

- [x] Meeting + participants + attendance record + overlap
- [x] Calendar adapter Manual/Null
- [x] UI: `/meetings`

**محدودیت:** OAuth Google/Outlook واقعی نیست.

## فاز ۵

- [x] GitLabConnection (توکن رمزگذاری‌شده)، Projects، Mappings، Webhook idempotent
- [x] گزارش فعالیت مهندسی با یادداشت ناقص بودن داده
- [x] UI: `/gitlab`, `/engineering`
- [x] تست: `phase5-gitlab.e2e-spec.ts`

**محدودیت:** sync عمدتاً پروژه‌ها/رویداد وب‌هوک؛ backfill کامل MR/Pipeline از REST محدود است.

## فاز ۶

- [x] Contract + ContractVersion (Decimal)
- [x] PayrollPeriod + CompensationProposal + Adjustments
- [x] ساعتی و تمام‌وقت؛ تمام‌وقت به‌خاطر Idle/Heartbeat کم نمی‌شود
- [x] UI: `/contracts`, `/payroll`, `/payroll/[id]`
- [x] تست: `phase6-payroll.e2e-spec.ts`

**محدودیت:** ساعات قابل پرداخت از مجموع WorkSession است نه گردش تأیید کامل فاز ۳؛ CRUD Adjustment در UI نیست.

## فاز ۷

- [x] `/api/reports/overview`, `attendance-summary`, `audit-export`
- [x] `/api/settings/organization`
- [x] هدرهای امنیتی پایه + CORS برای `X-Device-Token`
- [x] UI: `/reports`, `/settings`
- [x] docs: PRODUCTION، SECURITY، BACKUP، STATUS

**محدودیت:** Export اکسل/CSV جداگانه نیست (JSON audit)؛ Email notification نیست؛ Dark mode سوییچ UI ندارد.

## صفحات Frontend

ورود، داشبورد، گزارش‌ها، حضور، دستگاه‌ها، جلسات، هشدارها، اعلان‌ها، اصلاح حضور، سیاست‌ها، کاربران، GitLab، مهندسی، قراردادها، حقوق، حسابرسی، تنظیمات — همه فارسی/RTL و متصل به Backend واقعی.

## فرمان‌ها

```bash
# توسعه / تست (بدون Docker build)
cd apps/api && npx prisma generate && npm run build
npm run test -w @workpulse/api
# e2e نیاز به Postgres:
export DATABASE_URL=postgresql://workpulse:...@localhost:5432/workpulse?schema=public
npm run test:e2e -w @workpulse/api

# Agent
cd apps/agent && make build-all

# استقرار نهایی
cp .env.example .env
docker compose up -d --build
```
