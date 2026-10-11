# Development guide

## Dockerized run (recommended)

```bash
cp .env.example .env
docker compose up -d --build
```

Note: if your shell exports `DATABASE_URL` with `localhost`, Compose prefers that over `.env` and the API container may fail to reach Postgres. `unset DATABASE_URL` before `docker compose up`.

## Local API / Web development

1. Postgres port `5432` is exposed in `docker-compose.yml` for local use.
2. Outside containers:

```bash
export DATABASE_URL="postgresql://workpulse:change_me_strong_password@localhost:5432/workpulse?schema=public"
npm install
npm run prisma:generate --workspace=@workpulse/api
npm run prisma:migrate --workspace=@workpulse/api
npm run dev:api
npm run dev:web
```

## Tests

```bash
npm run test --workspace=@workpulse/api

# e2e wipes test data — use a disposable database
export DATABASE_URL="postgresql://workpulse:change_me_strong_password@localhost:5432/workpulse?schema=public"
npm run test:e2e --workspace=@workpulse/api
# Then restart API if you need bootstrap admin again
docker compose restart api
```

## Documentation language

- Product UI strings: Persian
- Repository markdown (`README`, `docs/*`, `CONTRIBUTING`): English
