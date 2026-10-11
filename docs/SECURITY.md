# Security and privacy

## Principles

1. No real secrets in the repository; use `.env`.
2. Passwords are hashed with bcrypt.
3. Authorization is enforced in the backend with role/permission guards.
4. Organization data is isolated with `organizationId` filters.
5. Session tokens and device tokens are revocable.
6. Sensitive fields are redacted from audit logs.
7. GitLab tokens are encrypted with AES-256-GCM and stored only on the server.
8. GitLab webhooks are validated when `GITLAB_WEBHOOK_SECRET` is set.

## Agent data collection

The agent **must not** capture screenshots, keystrokes, clipboard contents, audio, or video.

Allowed data:

- Work start / end events
- Heartbeat and connectivity state
- Idle and screen lock (on supported OS APIs)
- Agent version and device identifier

## HTTP hardening

- CORS limited to `CORS_ORIGINS`
- Rate limiting
- Headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- ValidationPipe with whitelist

## Production recommendations

See [PRODUCTION.md](PRODUCTION.md).
