# معماری WorkPulse

## رویکرد

نسخه اول به‌صورت **Modular Monolith** طراحی شده است:

- یک Backend NestJS با ماژول‌های جدا (Auth، Users، Roles، Audit، …)
- یک Frontend Next.js
- یک Desktop Agent مستقل (Go)
- یک پایگاه داده PostgreSQL

این رویکرد برای استقرار on-premises روی سرور اختصاصی شرکت ساده‌تر از Microservices است و در عین حال مرزهای دامنه را برای رشد بعدی حفظ می‌کند.

## دیاگرام منطقی

```
[مرورگر RTL/FA] ---> [Next.js Web]
                         |
                         v
                   [NestJS API] <--- [Go Agent]
                         |
                         v
                   [PostgreSQL]
```

## تصمیم‌های کلیدی

| موضوع | تصمیم | دلیل |
|--------|--------|------|
| ORM | Prisma | Migration نسخه‌بندی‌شده، تایپ‌سیف، مناسب NestJS |
| احراز هویت | JWT Bearer + جدول نشست | امکان لغو نشست و Audit |
| چندسازمانی | `organizationId` روی موجودیت‌ها | ایزوله بودن داده |
| Bootstrap | فقط وقتی `users.count = 0` | جلوگیری از ایجاد مدیر تکراری |
| زمان | UTC در DB | تبدیل به TZ سازمان/کاربر در UI |
| مجوز | AGPL-3.0 | مناسب نرم‌افزار سازمانی متن‌باز با شبکه |

## ماژول‌های Backend (فاز ۱)

- `auth` — ورود/خروج/me
- `users` — مدیریت کاربران
- `roles` — نقش‌ها و مجوزهای سیستمی
- `organizations` — سازمان جاری
- `bootstrap` — راه‌اندازی اولیه
- `audit` — رویدادهای حسابرسی
