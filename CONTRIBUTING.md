# راهنمای مشارکت در WorkPulse

از مشارکت شما استقبال می‌کنیم.

## پیش‌نیاز توسعه محلی

- Node.js 20+
- Docker و Docker Compose
- (اختیاری برای Agent) Go 1.22+

## راه‌اندازی محیط توسعه

```bash
cp .env.example .env
docker compose up -d --build
```

پنل: `http://localhost:3000`  
API و Swagger: `http://localhost:4000/api/docs`

## ساختار

- `apps/api` — Backend NestJS + Prisma
- `apps/web` — Frontend Next.js (فارسی/RTL)
- `apps/agent` — Desktop Agent (Go)
- `packages/shared-types` — تایپ‌های مشترک
- `infra` — Docker و اسکریپت‌ها
- `docs` — مستندات

## قواعد کدنویسی

1. UI قابل مشاهده برای کاربر باید فارسی و RTL باشد.
2. زمان‌ها در Backend به‌صورت UTC ذخیره شوند.
3. Secret واقعی در کد یا Git قرار نگیرد.
4. قابلیت‌های اصلی نباید صرفاً نمایشی باشند.
5. برای منطق حساس (حضور، حقوق، دسترسی) تست بنویسید.
6. کاربران دارای سابقه را حذف فیزیکی نکنید؛ غیرفعال کنید.

## تست

```bash
# تست واحد API
npm run test --workspace=@workpulse/api

# تست e2e (نیاز به DATABASE_URL)
export DATABASE_URL="postgresql://workpulse:change_me_strong_password@localhost:5432/workpulse?schema=public"
npm run test:e2e --workspace=@workpulse/api
```

## Pull Request

- یک موضوع مشخص در هر PR
- توضیح تغییرات و نحوه تست
- به‌روزرسانی `docs/STATUS.md` در صورت تغییر وضعیت قابلیت‌ها
