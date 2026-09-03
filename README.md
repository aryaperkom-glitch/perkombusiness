# Officeless / Perkom Expense Approval System

Next.js application for managing employee expense claims (Grab transport),
managed-service claims, approvals via WhatsApp, and EnvGate service-desk requests.

## Architecture

```
Next.js app (app service)
   │
   ├── PostgreSQL 18 (db service, Docker volume: postgres_data)
   │     all application data: app_users (login), employees, claims, trips,
   │     comments, whatsapp_logs, signatures, uploads, managed_service_claims
   │
   ├── Uploads volume (Docker volume: uploads_data → /app/uploads)
   │     statement files and managed-service claim attachments,
   │     served through the auth-protected /api/files route
   │
   └── External APIs: Kirimi (WhatsApp), Perkom Service Desk (EnvGate)
```

- The app talks to PostgreSQL through the Docker Compose service name `db`
  (`DATABASE_URL` is assembled inside `compose.yaml`).
- Database access goes through a `pg` pool (`src/lib/db.ts`) with parameterized SQL.
- Login uses local `app_users` (scrypt password hashes) and an HMAC-signed
  session cookie (`src/lib/auth.ts`, `SESSION_SECRET`).
- File uploads live on a Docker volume (`src/lib/storage.ts`), served by
  `/api/files/*` after session verification.

## Prerequisites

- Docker Desktop
- Node.js 20+ and npm (for host-side development)

## Environment setup

```bash
cp .env.example .env
```

Then fill in `.env`:

| Variable | Purpose |
|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Local PostgreSQL container credentials |
| `DATABASE_URL` | Used by the app on the host (in Docker, compose injects `db:5432` automatically) |
| `SESSION_SECRET` | Signs the login session cookie — generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` |
| `SERVICEDESK_USERNAME` / `SERVICEDESK_PASSWORD` | EnvGate service desk API |
| `KIRIMI_USER_CODE` / `KIRIMI_SECRET` / `KIRIMI_DEVICE_ID` | WhatsApp gateway |

No credentials are committed; `.env*` is git-ignored (only `.env.example` is tracked).

## Login users

Auth is local (no Supabase): users live in the `app_users` table with scrypt
password hashes, sessions are HMAC-signed cookies.

```bash
# 1. Apply the users table on an existing database (fresh volumes get it via db/init):
docker compose exec -T db psql -U officeless -d officeless < db/migrations/2026-09-01-app-users.sql

# 2. Create or reset a login user (host needs DATABASE_URL in .env):
node scripts/create-user.mjs email@example.com password "Full Name"
```

### Migrating from Supabase (one-off)

Set `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`, then:

```bash
node --env-file=.env scripts/import-supabase-users.mjs   # imports users, prints temp passwords
node --env-file=.env scripts/import-supabase-files.mjs   # copies bucket "dataperkom" into the uploads volume
```

Supabase cannot export password hashes, so imported users get temporary
passwords printed once — reset them with `scripts/create-user.mjs`.

## Daily commands

Operational scripts (deploy, migrate, backup, docker, cache): see **docs/operations.md**.

```bash
docker compose up -d          # start db + app
docker compose up -d db       # start only the database
docker compose logs -f app    # tail app logs
docker compose logs -f db     # tail database logs
docker compose down           # stop (data volume persists)
docker compose up -d --build  # rebuild the app image after code changes
```

`docker compose down -v` **destroys the database volume** — do not run it as part of normal work.

### Database shell / tools

```bash
docker compose exec db psql -U officeless -d officeless
```

PostgreSQL is published on `127.0.0.1:5432` for host tools (DBeaver, pgAdmin);
it is not reachable from outside the machine.

### Development on the host

```bash
docker compose up -d db   # database in Docker
npm run dev               # app on host, uses DATABASE_URL from .env (localhost:5432)
```

## Backup / restore (local database only)

```bash
# backup
docker compose exec db pg_dump -U officeless -d officeless > backup.sql

# restore (drops and recreates the local database)
docker compose exec db psql -U officeless -d postgres -c "DROP DATABASE officeless WITH (FORCE);"
docker compose exec db psql -U officeless -d postgres -c "CREATE DATABASE officeless;"
Get-Content backup.sql | docker compose exec -T db psql -U officeless -d officeless
```

## Lint / typecheck / build

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Note: `npm run lint` reports pre-existing findings in legacy files
(`parser.ts`, `dashboard-store.ts`); none of them come from
the migrated database layer.

## Troubleshooting

- **Docker Desktop never starts / engine returns 500** — check
  `%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log`. If it says
  `Virtual Machine Platform not enabled`, run this in an **admin** PowerShell
  and reboot:
  ```powershell
  dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
  ```
- **App container logs `ECONNREFUSED db:5432`** — the db service healthcheck
  gates app startup; run `docker compose ps` and check `db` is `healthy`.
- **Login always rejected** — check `SESSION_SECRET` is set in `.env`, the
  `app_users` table exists (see *Login users* above), and a user was created
  with `scripts/create-user.mjs`.
- **Database schema changes** — `db/init/01_schema.sql` only runs on a fresh
  volume. For schema changes on an existing volume use `psql` directly (take a
  `pg_dump` backup first — see above).
- **Port 5432 already in use on the host** — another PostgreSQL is running;
  change the published port in `compose.yaml` (`127.0.0.1:5433:5432`).

## Migration notes (Supabase → Docker PostgreSQL)

- Schema recreated from `supabase/migrations/001-005` + `schema.sql`.
- Differences, required by the migration:
  - No RLS policies — they relied on Supabase `auth.role()`; the app connects
    through a single trusted server-side pool.
  - `uploads.uploaded_by` is a plain UUID (historically Supabase Auth user ids;
    new rows store `app_users` ids — no foreign key either way).
  - `claims.status` also allows `'MERGED'` (written by the managed-service merge endpoint).
- `/api/claims/managed-service` now returns `employee_name` directly on
  `grab_match` (the previous query selected a non-existent `employees.name`
  column, so `grab_match` was always `null`).
- Auth and Storage were moved off Supabase: login is local (`app_users` +
  signed session cookie) and uploads live on the `uploads_data` volume.
  Historical `managed_service_claims.file_url` rows still point at the old
  Supabase Storage public URLs — they keep working only while that Supabase
  project exists.
