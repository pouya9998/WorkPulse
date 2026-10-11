# راهنمای توسعه

## اجرای Dockerized (پیشنهادی)

```bash
cp .env.example .env
docker compose up -d --build
```

نکته: اگر در شِل متغیر `DATABASE_URL` با `localhost` export شده باشد، Compose آن را بر `.env` اولویت می‌دهد و کانتینر API به دیتابیس وصل نمی‌شود. قبل از `docker compose up` آن را `unset` کنید.

## توسعه محلی API/Web

1. پورت Postgres در `docker-compose.yml` باز است (`5432`).
2. برای توسعه خارج از کانتینر:

```bash
export DATABASE_URL="postgresql://workpulse:change_me_strong_password@localhost:5432/workpulse?schema=public"
npm install
npm run prisma:generate --workspace=@workpulse/api
npm run prisma:migrate --workspace=@workpulse/api
npm run dev:api
npm run dev:web
```

## تست

```bash
npm run test --workspace=@workpulse/api

# e2e دیتابیس را پاک می‌کند — روی محیط توسعه جداگانه اجرا کنید
export DATABASE_URL="postgresql://workpulse:change_me_strong_password@localhost:5432/workpulse?schema=public"
npm run test:e2e --workspace=@workpulse/api
# سپس API را restart کنید تا Bootstrap مدیر دوباره اجرا شود
docker compose restart api
```
