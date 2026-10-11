# Production guide

## Before deploy

1. Create `.env` from `.env.example` and rotate all secrets:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET` (random, at least 32 characters)
   - `ENCRYPTION_KEY` (at least 32 characters; used for GitLab tokens)
   - `BOOTSTRAP_ADMIN_PASSWORD`
   - `GITLAB_WEBHOOK_SECRET` if you use GitLab webhooks
2. Restrict `CORS_ORIGINS` to your real web origin(s).
3. Do not expose PostgreSQL to the public internet (Compose currently maps `5432` for development convenience).
4. Put HTTPS in front of the services (Caddy/Nginx reverse proxy).
5. Change the bootstrap admin password immediately after first login.

## Deploy

```bash
cp .env.example .env
# Edit secrets
docker compose up -d --build
docker compose ps
curl https://your-api.example/api/health
```

Migrations are applied on API startup with `prisma migrate deploy`.

## Backup

```bash
./infra/scripts/backup.sh
./infra/scripts/restore.sh backups/workpulse-....sql.gz
```

Warning: `docker compose down -v` deletes volumes and data.

## Minimum monitoring

- Container healthchecks
- Logs: `docker compose logs -f api`
- Periodic review of `/api/reports/overview` by an admin

## Hardening already in the codebase

- bcrypt password hashing
- JWT + revocable sessions
- Backend RBAC
- Rate limiting
- Restricted CORS
- Basic security headers
- Audit log with sensitive-field redaction
- Server-side GitLab token encryption
- GitLab webhook secret validation when configured
