# GitLab integration

Status: **implemented for phase 5** (with limitations)

## Configuration

- GitLab base URL (gitlab.com or self-hosted)
- Access token stored encrypted on the server (`ENCRYPTION_KEY`)
- Optional webhook secret (`GITLAB_WEBHOOK_SECRET`)
- Explicit user mapping (do not assume email/username equality)

## Capabilities

- Configure connection and list/connect projects
- User mappings CRUD (API; UI currently focuses on connection/status)
- Webhook endpoint with idempotent event storage
- Periodic sync helper (currently mainly project listing)
- Engineering activity report with incompleteness notes

## Important product rules

- Tokens stay server-side only
- Validate webhooks when a secret is configured
- Never treat commit/MR counts alone as definitive productivity

## Limitations

- Full REST backfill of MRs/reviews/pipelines is limited
- Dedicated review webhook coverage is incomplete
- Mapping create/edit is primarily via API

Related routes: `/api/gitlab/*` (see Swagger).
