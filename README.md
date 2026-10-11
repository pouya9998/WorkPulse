# WorkPulse

**Open-source platform for remote workforce management and software-engineer performance evaluation**

WorkPulse helps remote engineering teams manage attendance, device/agent status, meetings, engineering activity (GitLab), alerts, contracts, and proposed payroll reports — with a Persian RTL product UI and Jalali calendar support.

| | |
|---|---|
| License | [AGPL-3.0-or-later](LICENSE) |
| Architecture | Modular monolith |
| Product UI | Persian · RTL · Jalali calendar · Vazirmatn |
| Deployment | Docker Compose (on-premises) |

---

## Table of contents

- [Features](#features)
- [Architecture and stack](#architecture-and-stack)
- [Requirements](#requirements)
- [Quick start with Docker](#quick-start-with-docker)
- [Repository structure](#repository-structure)
- [Environment configuration](#environment-configuration)
- [Desktop Agent](#desktop-agent)
- [Local development](#local-development)
- [Tests](#tests)
- [Backup and restore](#backup-and-restore)
- [Documentation](#documentation)
- [Implementation status](#implementation-status)
- [Security and privacy](#security-and-privacy)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Users and access control
- Create, edit, activate/deactivate users (no hard-delete of historical records)
- Roles: Super Admin, Organization Admin, Team Lead, Employee, Payroll Reviewer
- Real backend RBAC and revocable JWT sessions
- Secure bootstrap of the first admin (only when no users exist yet)

### Attendance and desktop agent
- Work start / end and heartbeat (default every 60 seconds)
- Idle and screen-lock detection (best effort on Linux / Windows)
- Local offline queue with resync
- Device registration and admin revoke
- **The agent does not capture screenshots, keystrokes, clipboard, audio, or video**

### Meetings
- Manual meeting create/cancel, participants, overlap detection vs work sessions
- Extensible calendar adapter (real Google/Outlook OAuth is stubbed in the current version)

### GitLab
- Connect to GitLab.com or self-hosted GitLab
- Webhooks with optional secret validation
- Explicit GitLab identity mapping to employees
- Engineering activity report with incompleteness notes  
  (commits/MRs alone are not treated as definitive productivity)

### Contracts and proposed payroll
- Hourly and full-time remote contracts with **versioning**
- Money math with Decimal (no floating point)
- Full-time pay is not auto-reduced for idle/missing heartbeat
- Reviewer approve/reject workflow for proposals

### Alerts, reports, and audit
- Configurable alerts and in-panel notifications
- Attendance corrections with manager approval
- Management reports and audit export
- Audit log for sensitive actions

---

## Architecture and stack

```
[Browser RTL/FA] ---> [Next.js Web]
                         |
                         v
                   [NestJS API] <--- [Go Desktop Agent]
                         |
                         v
                   [PostgreSQL]
```

| Layer | Technology |
|------|-----------|
| Frontend | Next.js, TypeScript, Tailwind, date-fns-jalali |
| Backend | NestJS, Prisma, REST, OpenAPI/Swagger |
| Database | PostgreSQL with versioned migrations |
| Agent | Go (Linux / Windows) |
| Infra | Docker Compose, healthchecks, persistent volume |

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Requirements

### Dockerized run (recommended)
- Docker Engine
- Docker Compose v2+
- About 2GB free RAM

You do not need Node.js, Go, or PostgreSQL on the host for the Dockerized stack.

### Local development (optional)
- Node.js 20+
- Go 1.22+ (for the agent)
- PostgreSQL (or Compose Postgres)

---

## Quick start with Docker

```bash
git clone https://github.com/pouya9998/WorkPulse.git
cd WorkPulse
cp .env.example .env
# Change POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, and bootstrap admin password
docker compose up -d --build
```

| Service | URL |
|--------|------|
| Web UI | http://localhost:3000 |
| API | http://localhost:4000/api |
| Swagger | http://localhost:4000/api/docs |

Initial login uses `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` from `.env`.

### Common commands

```bash
docker compose ps
docker compose logs -f
docker compose down          # keeps the database volume
docker compose down -v       # destructive: deletes volumes and all data
```

Migrations run on API startup via `prisma migrate deploy`.

Install guide: [docs/INSTALL.md](docs/INSTALL.md)  
Production guide: [docs/PRODUCTION.md](docs/PRODUCTION.md)

---

## Repository structure

```
WorkPulse/
├── apps/
│   ├── api/                 # NestJS + Prisma backend
│   ├── web/                 # Next.js frontend (Persian / RTL UI)
│   └── agent/               # Go desktop agent
├── packages/
│   └── shared-types/        # Shared TypeScript types
├── infra/
│   ├── docker/              # Dockerfiles and entrypoint
│   └── scripts/             # Backup / restore
├── docs/                    # Documentation (English)
├── docker-compose.yml
├── .env.example
├── LICENSE                  # AGPL-3.0
├── CONTRIBUTING.md
└── README.md
```

---

## Environment configuration

Copy `.env.example` and set values. **Never commit `.env`.**

Important variables:

| Variable | Purpose |
|--------|--------|
| `POSTGRES_*` / `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | JWT signing secret (strong random value) |
| `ENCRYPTION_KEY` | Encrypt GitLab tokens at rest |
| `CORS_ORIGINS` | Allowed frontend origins |
| `BOOTSTRAP_ADMIN_*` | First admin (empty-install only) |
| `GITLAB_WEBHOOK_SECRET` | Webhook validation (optional) |
| `NEXT_PUBLIC_API_URL` | API URL as seen by the browser |

Note: if your shell exports `DATABASE_URL=...@localhost`, Compose prefers that over `.env` and the API container may fail to reach Postgres. `unset DATABASE_URL` before `docker compose up`.

---

## Desktop Agent

```bash
cd apps/agent
make build-linux    # or make build-windows / make build-all

./bin/workpulse-agent-linux-amd64 login \
  -api http://localhost:4000/api \
  -email employee@example.com \
  -password '********'

./bin/workpulse-agent-linux-amd64 run
./bin/workpulse-agent-linux-amd64 start-work
./bin/workpulse-agent-linux-amd64 end-work
./bin/workpulse-agent-linux-amd64 status
```

Config: `~/.workpulse/config.json`  
Offline queue: `~/.workpulse/offline-queue.db`

Full guide: [docs/AGENT.md](docs/AGENT.md)

---

## Local development

```bash
cp .env.example .env
# Point DATABASE_URL at localhost for host-side development
npm install
npm run prisma:generate --workspace=@workpulse/api
npm run prisma:migrate --workspace=@workpulse/api
npm run dev:api    # usually :4000
npm run dev:web    # usually :3000
```

---

## Tests

```bash
# Unit
npm run test --workspace=@workpulse/api

# e2e (requires reachable PostgreSQL)
export DATABASE_URL="postgresql://workpulse:change_me_strong_password@localhost:5432/workpulse?schema=public"
export JWT_SECRET="change_me_jwt_secret_min_32_chars_long!!"
export ENCRYPTION_KEY="change_me_encryption_key_min_32_chars"
# Avoid accidental bootstrap during tests:
export BOOTSTRAP_ADMIN_EMAIL=""
export BOOTSTRAP_ADMIN_PASSWORD=""
npm run test:e2e --workspace=@workpulse/api
```

Warning: e2e tests may wipe test database data. Do not run them against production.

---

## Backup and restore

```bash
./infra/scripts/backup.sh
./infra/scripts/restore.sh backups/workpulse-YYYYMMDDTHHMMSSZ.sql.gz
```

Details: [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)

---

## Documentation

| Doc | Topic |
|-----|--------|
| [docs/INSTALL.md](docs/INSTALL.md) | Docker Compose install |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Production deployment |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture |
| [docs/API.md](docs/API.md) | API overview |
| [docs/AGENT.md](docs/AGENT.md) | Desktop agent |
| [docs/GITLAB.md](docs/GITLAB.md) | GitLab integration |
| [docs/CALENDAR.md](docs/CALENDAR.md) | Meetings and calendar |
| [docs/SECURITY.md](docs/SECURITY.md) | Security and privacy |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backup / restore |
| [docs/STATUS.md](docs/STATUS.md) | Honest implementation status |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development notes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributing guide |

Interactive API docs are available at `/api/docs` after startup.

---

## Implementation status

Phases 1–7 are implemented. Real limitations (for example stub calendar OAuth, limited GitLab sync, no email notifications) are documented in [docs/STATUS.md](docs/STATUS.md).

A feature is only claimed as implemented when the corresponding code and tests exist.

---

## Security and privacy

- No real secrets in source; use environment variables
- bcrypt password hashing; JWT with revocable sessions
- Organization data isolation
- Rate limiting, restricted CORS, basic security headers
- GitLab tokens encrypted server-side
- Audit log with sensitive-field redaction

Details: [docs/SECURITY.md](docs/SECURITY.md)

---

## Contributing

Pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md):

1. User-visible product UI stays Persian and RTL.
2. Store timestamps in UTC in the backend.
3. Core features must not be fake/demo-only.
4. Add tests for sensitive logic.

---

## License

Released under the **GNU Affero General Public License v3.0 or later**.

Full text: [LICENSE](LICENSE)
