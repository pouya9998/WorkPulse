# API documentation

Interactive Swagger UI after startup:

`http://localhost:4000/api/docs`

## Phase 1 essentials

| Method | Path | Description | Access |
|-----|------|--------|--------|
| GET | `/api/health` | Health check | Public |
| GET | `/api/bootstrap/status` | Bootstrap status | Public |
| POST | `/api/auth/login` | Login | Public |
| POST | `/api/auth/logout` | Logout | Authenticated |
| GET | `/api/auth/me` | Current user | Authenticated |
| GET | `/api/users` | List users | `users:read` |
| POST | `/api/users` | Create user | `users:write` |
| PATCH | `/api/users/:id` | Update user | `users:write` |
| POST | `/api/users/:id/deactivate` | Deactivate | `users:deactivate` |
| POST | `/api/users/:id/activate` | Activate | `users:write` |
| GET | `/api/roles` | Roles | `users:read` |
| GET | `/api/audit-logs` | Audit log | `audit:read` |
| GET | `/api/organizations/me` | Current organization | Authenticated |

Auth header: `Authorization: Bearer <token>`  
Agent header: `X-Device-Token`

## Phases 2–7 (overview)

| Area | Main routes |
|------|----------------|
| Agent / devices | `/api/agent/*`, `/api/devices` |
| Attendance | `/api/attendance/status`, `/timeline` |
| Policies / corrections | `/api/attendance-policies`, `/api/attendance-corrections` |
| Alerts / notifications | `/api/alerts`, `/api/notifications` |
| Meetings | `/api/meetings` |
| GitLab | `/api/gitlab/*`, `/api/gitlab/webhooks` |
| Payroll | `/api/contracts`, `/api/payroll/*` |
| Reports / settings | `/api/reports/*`, `/api/settings/organization` |

Use Swagger at `/api/docs` for request/response schemas.
