#!/usr/bin/env bash
# Apply pending SQL migrations from db/migrations/ (tracked in schema_migrations).
set -euo pipefail
. "$(dirname "$0")/_common.sh"
lock storage/backups/.migrate.lock

log "waiting for db to accept connections..."
ready=0
for _ in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[ "$ready" = 1 ] || { err "database is not reachable/healthy"; exit 1; }

docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -q -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (
     filename TEXT PRIMARY KEY,
     applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )"

applied=0
skipped=0
shopt -s nullglob
for file in db/migrations/*.sql; do
  name="$(basename "$file")"
  if docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
      "SELECT 1 FROM schema_migrations WHERE filename = '$name'" | grep -q 1; then
    skipped=$((skipped + 1))
    continue
  fi
  log "applying $name ..."
  # -1: single transaction; -v ON_ERROR_STOP=1: abort the script on first error
  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -1 -v ON_ERROR_STOP=1 -q < "$file"
  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -q -c \
    "INSERT INTO schema_migrations (filename) VALUES ('$name') ON CONFLICT DO NOTHING"
  applied=$((applied + 1))
done

log "migrations: $applied applied, $skipped already up to date."
