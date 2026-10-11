# Implementation status

Last updated: 2026-10-11

## Phase summary

| Phase | Topic | Status |
|-----|--------|--------|
| 1 | Structure, Docker, auth, roles, users, Persian UI | **Implemented** |
| 2 | Go agent, devices, heartbeat, idle, offline queue | **Implemented** |
| 3 | Attendance policies, corrections, alerts, notifications | **Implemented** |
| 4 | Meetings and calendar adapters | **Implemented** (OAuth stub) |
| 5 | GitLab webhook/sync/engineering report | **Implemented** (limited sync) |
| 6 | Versioned contracts and proposed payroll | **Implemented** |
| 7 | Reports, settings, hardening, production docs | **Implemented** |

## Phase 2

- [x] RegisteredDevice + hashed device token
- [x] WorkSession / AttendanceEvent / Heartbeat / DeviceStateInterval
- [x] API: register, start/end work, heartbeat, events/sync, device revoke
- [x] Go Agent 0.2.0: login, run, start/end, offline SQLite queue, idle/lock best-effort
- [x] UI: `/attendance`, `/devices`
- [x] e2e: `test/attendance.e2e-spec.ts`

**Limitation:** Idle/lock on Linux depends on tools like `xprintidle` / `loginctl`.

## Phase 3

- [x] AttendancePolicy, AttendanceCorrection, Alert, Notification
- [x] Alert engine + dedupe + scheduler
- [x] UI: `/alerts`, `/corrections`, `/policies`, `/notifications`
- [x] Tests: `alerts-engine.service.spec.ts`, `phase3.e2e-spec.ts`

**Limitation:** Notifications are in-panel only; Break/Unresolved auto-population is incomplete.

## Phase 4

- [x] Meeting + participants + attendance record + overlap
- [x] Calendar adapters: Manual / Null
- [x] UI: `/meetings`

**Limitation:** Real Google/Outlook OAuth is not implemented.

## Phase 5

- [x] GitLabConnection (encrypted token), projects, mappings, idempotent webhooks
- [x] Engineering activity report with incompleteness notes
- [x] UI: `/gitlab`, `/engineering`
- [x] Tests: `phase5-gitlab.e2e-spec.ts`

**Limitation:** Sync is mainly project list + webhook events; full REST backfill of MRs/pipelines is limited.

## Phase 6

- [x] Contract + ContractVersion (Decimal)
- [x] PayrollPeriod + CompensationProposal + Adjustments
- [x] Hourly and full-time; full-time is not auto-cut for idle/heartbeat loss
- [x] UI: `/contracts`, `/payroll`, `/payroll/[id]`
- [x] Tests: `phase6-payroll.e2e-spec.ts`

**Limitation:** Payable hours are derived from WorkSession totals, not a full phase-3 approval pipeline; adjustment CRUD UI is missing.

## Phase 7

- [x] `/api/reports/overview`, `attendance-summary`, `audit-export`
- [x] `/api/settings/organization`
- [x] Basic security headers + CORS for `X-Device-Token`
- [x] UI: `/reports`, `/settings`
- [x] Docs: PRODUCTION, SECURITY, BACKUP, STATUS

**Limitation:** No separate Excel/CSV export (JSON audit); no email notifications; no dark-mode UI toggle.

## Frontend pages

Login, dashboard, reports, attendance, devices, meetings, alerts, notifications, corrections, policies, users, GitLab, engineering, contracts, payroll, audit, settings — all Persian/RTL and backed by real APIs.

## Verification commands

```bash
# Dev / tests (no Docker rebuild required)
cd apps/api && npx prisma generate && npm run build
npm run test -w @workpulse/api
# e2e needs Postgres:
npm run test:e2e -w @workpulse/api

# Agent
cd apps/agent && make build-all

# Final deploy
cp .env.example .env
docker compose up -d --build
```
