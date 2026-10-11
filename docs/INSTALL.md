# راهنمای نصب با Docker Compose

## پیش‌نیاز

- Docker Engine
- Docker Compose v2+
- حداقل ۲GB RAM آزاد

نیازی به نصب Node.js، Go یا PostgreSQL روی Host برای اجرای نسخه Dockerized نیست.

## نصب

```bash
git clone <repo-url> WorkPulse
cd WorkPulse
cp .env.example .env
# مقادیر رمز عبور، JWT و مدیر اولیه را ویرایش کنید
docker compose up -d --build
```

## بررسی وضعیت

```bash
docker compose ps
docker compose logs -f
curl http://localhost:4000/api/health
```

پنل وب: `http://localhost:3000`  
Swagger: `http://localhost:4000/api/docs`

ورود اولیه با `BOOTSTRAP_ADMIN_EMAIL` و `BOOTSTRAP_ADMIN_PASSWORD` از فایل `.env`.

Bootstrap فقط زمانی مدیر می‌سازد که هنوز هیچ کاربری وجود نداشته باشد.

## توقف

```bash
docker compose down
```

داده‌های دیتابیس در Volume `workpulse_pg_data` باقی می‌مانند.

## حذف کامل داده (خطرناک)

```bash
docker compose down -v
```

این فرمان Volumeها را حذف می‌کند و داده‌ها از بین می‌روند.
