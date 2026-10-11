# Architecture

## Approach

The first release is a **modular monolith**:

- One NestJS backend with separated modules (Auth, Users, Roles, Attendance, Alerts, Meetings, GitLab, Payroll, …)
- One Next.js frontend
- One independent desktop agent (Go)
- One PostgreSQL database

This is simpler to deploy on-premises than microservices, while keeping domain boundaries for later growth.

## Logical diagram

```
[Browser RTL/FA] ---> [Next.js Web]
                         |
                         v
                   [NestJS API] <--- [Go Agent]
                         |
                         v
                   [PostgreSQL]
```

## Key decisions

| Topic | Decision | Why |
|--------|--------|------|
| ORM | Prisma | Versioned migrations, type-safe client, NestJS fit |
| Auth | JWT Bearer + session table | Revocation and audit |
| Multi-tenant | `organizationId` on entities | Data isolation |
| Bootstrap | Only when `users.count = 0` | Prevent duplicate first admins |
| Time | UTC in DB | Convert to org/user TZ in UI |
| License | AGPL-3.0 | Open-source network-facing enterprise software |

## Backend modules (by phase)

- `auth`, `users`, `roles`, `organizations`, `bootstrap`, `audit`
- `devices`, `attendance` (agent + timeline)
- `attendance-policies`, `attendance-corrections`, `alerts`, `notifications`
- `meetings` (+ calendar adapters)
- `gitlab`, `payroll`
- `reports`, `settings`
