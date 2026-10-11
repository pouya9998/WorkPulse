# Install with Docker Compose

## Prerequisites

- Docker Engine
- Docker Compose v2+
- At least ~2GB free RAM

You do not need Node.js, Go, or PostgreSQL installed on the host for the Dockerized stack.

## Install

```bash
git clone https://github.com/pouya9998/WorkPulse.git
cd WorkPulse
cp .env.example .env
# Edit passwords, JWT secret, encryption key, and bootstrap admin credentials
docker compose up -d --build
```

## Verify

```bash
docker compose ps
docker compose logs -f
curl http://localhost:4000/api/health
```

Web UI: `http://localhost:3000`  
Swagger: `http://localhost:4000/api/docs`

Initial login uses `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` from `.env`.

Bootstrap creates an admin only when no users exist yet.

## Stop

```bash
docker compose down
```

Database data remains in the `workpulse_pg_data` volume.

## Full data wipe (dangerous)

```bash
docker compose down -v
```

This deletes volumes and all stored data.
