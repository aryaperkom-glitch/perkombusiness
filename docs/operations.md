# Operations

All commands run from the project root on the server. Scripts live in `scripts/`
and are plain Bash + `docker compose` — no extra tooling.

```bash
./scripts/deploy.sh                 # deploy latest from git origin
./scripts/migrate.sh                # apply pending db/migrations/*.sql
./scripts/docker.sh status          # containers + db health + app HTTP check
./scripts/docker.sh logs [service]  # tail logs (app | db)
./scripts/docker.sh up|down|restart # down NEVER removes volumes
./scripts/cache.sh status|clean|prune
./scripts/backup.sh                 # backup db + files now
./scripts/backup.sh list|verify
./scripts/backup.sh restore-db <file>
./scripts/backup.sh install-cron
```

## Architecture

- `app` — Next.js (builds from `Dockerfile`, port 3000, `/api/*` + pages)
- `db` — PostgreSQL 18 (named volume `postgres_data`, init scripts `db/init/`,
  published on `127.0.0.1:5432` only, healthcheck `pg_isready`)
- Uploaded files — host bind mount `./storage/uploads` → `/app/uploads`
  (survives rebuilds/redeploys; trivially backupable)

## Deployment

`./scripts/deploy.sh` fetches the tracked branch (`origin`, current branch, or
`DEPLOY_BRANCH` from `.env`), pulls **fast-forward only**, refuses to run on a
dirty working tree (never discards anything), rebuilds `app` with layer caching,
runs migrations, recreates services, and health-checks both `db` and the app.

## Database migrations

Add `db/migrations/YYYY-MM-DD-name.sql` (idempotent where possible).
`./scripts/migrate.sh` applies pending files in filename order, each in a single
transaction, tracked in the `schema_migrations` table. Never resets the database.

## Backups

`./scripts/backup.sh` produces:

```
storage/backups/database/db-YYYY-MM-DD_HHMMSS.sql.gz   (pg_dump | gzip)
storage/backups/files/files-YYYY-MM-DD_HHMMSS.tar.gz   (tar of storage/uploads)
```

- `verify` runs `gzip -t` / `tar -tzf` integrity checks
- retention: `RETENTION_DAYS=14` (default) — only old *backup files* are deleted
- replication (off by default): set `BACKUP_REMOTE=user@host:/srv/backups/officeless/`
  in `.env` and have ssh keys ready — backups are then rsynced there after each run

## Restore

Prefer restoring on a stopped app: `./scripts/docker.sh down`, restore, `up`.

```bash
./scripts/backup.sh list
./scripts/backup.sh restore-db storage/backups/database/db-....sql.gz
```

The command prints current table count, then requires typing `RESTORE`.
It drops the `public` schema and restores the full dump (schema + data).

Files: `tar -xzf storage/backups/files/files-....tar.gz -C storage` (overwrites
`storage/uploads`).

## Automatic daily backup

```bash
./scripts/backup.sh install-cron    # daily 02:17, logs to storage/backups/backup.log
```

Idempotent (skips if the `# officeless-backup` marker exists). Verify with
`crontab -l`. Schedule time is inside the entry — edit via `crontab -e`.

## First deploy on a new VPS

```bash
git clone <repo> && cd officeless
cp .env.example .env   # fill in: POSTGRES_PASSWORD, SESSION_SECRET, ...
mkdir -p storage/uploads && sudo chown 1000:1000 storage/uploads  # app writes as uid 1000
docker compose up -d   # fresh db volume gets schema from db/init/
# then load existing data (optional):
docker compose exec -T db psql -U officeless -d officeless < db-backup/vps-seed.sql
```

Bind-mount note: Docker creates `storage/uploads` as root if missing; the app
container runs as `nextjs` (uid 1000) — hence the `chown` above.
