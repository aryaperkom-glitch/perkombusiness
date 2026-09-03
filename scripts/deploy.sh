#!/usr/bin/env bash
# Deploy the latest version from git origin safely:
#   fetch -> ff-only pull -> build -> migrate -> up -> health check -> summary
#
# Never resets/discards local changes; never touches .env or volumes.
set -euo pipefail
. "$(dirname "$0")/_common.sh"
lock storage/backups/.deploy.lock

log "checking tools..."
command -v git >/dev/null || { err "git not found"; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose not available"; exit 1; }

git remote get-url origin >/dev/null 2>&1 \
  || { err "no git remote 'origin' configured. Run: git remote add origin <url>"; exit 1; }
branch="${DEPLOY_BRANCH:-$(git branch --show-current)}"
[ -n "$branch" ] || { err "not on any branch"; exit 1; }

if [ -n "$(git status --porcelain)" ]; then
  err "working tree has local changes — commit or stash them first (nothing was discarded):"
  git status --short
  exit 1
fi

before="$(git rev-parse --short HEAD)"
log "current commit: $before ($branch)"

log "fetching origin..."
git fetch origin
git pull --ff-only origin "$branch"

after="$(git rev-parse --short HEAD)"
log "deploying commit: $after"
if [ "$before" = "$after" ]; then
  log "no new commits — recreating anyway (compose config may have changed)."
fi

log "building app image (Docker layer cache applies)..."
docker compose build app

log "running database migrations..."
"$ROOT/scripts/migrate.sh"

log "starting services..."
docker compose up -d

log "waiting for health checks..."
ready=0
for _ in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[ "$ready" = 1 ] || { err "database did not become ready"; exit 1; }

code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login || true)"
[ "$code" = "200" ] || { err "app health check failed (HTTP $code) — see ./scripts/docker.sh logs app"; exit 1; }
log "app healthy (HTTP $code)"

log "deployment completed: $before -> $after"
