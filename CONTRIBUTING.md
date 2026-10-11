# Contributing to WorkPulse

Thanks for your interest in contributing.

## Local development prerequisites

- Node.js 20+
- Docker and Docker Compose
- (Optional, for the agent) Go 1.22+

## Getting started

```bash
cp .env.example .env
docker compose up -d --build
```

Web UI: `http://localhost:3000`  
API / Swagger: `http://localhost:4000/api/docs`

## Repository layout

- `apps/api` — NestJS + Prisma backend
- `apps/web` — Next.js frontend (Persian / RTL product UI)
- `apps/agent` — Desktop agent (Go)
- `packages/` — shared packages
- `infra` — Docker and scripts
- `docs/` — English documentation

## Coding guidelines

1. User-visible product UI must remain Persian and RTL.
2. Repository markdown docs (`README`, `docs/*`, `CONTRIBUTING`) should be English.
3. Store timestamps in UTC in the backend.
4. Never commit real secrets.
5. Core features must not be purely decorative/fake.
6. Add tests for sensitive logic (attendance, payroll, access control).
7. Do not hard-delete users that have attendance, contract, or payroll history; deactivate them.

## Tests

```bash
# API unit tests
npm run test --workspace=@workpulse/api

# e2e (requires DATABASE_URL)
export DATABASE_URL="postgresql://workpulse:change_me_strong_password@localhost:5432/workpulse?schema=public"
npm run test:e2e --workspace=@workpulse/api
```

## Pull requests

- Keep each PR focused on one topic
- Describe the change and how you tested it
- Update `docs/STATUS.md` when feature status changes
