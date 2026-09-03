#!/usr/bin/env bash
# Docker management: up/down/restart/ps/status/logs
set -euo pipefail
. "$(dirname "$0")/_common.sh"

cmd="${1:-}"
case "$cmd" in
  up)
    docker compose up -d
    ;;
  down)
    # Never -v: named volumes (postgres_data) must survive
    docker compose down
    ;;
  restart)
    if [ $# -ge 2 ]; then docker compose restart "$2"; else docker compose restart; fi
    ;;
  ps)
    docker compose ps
    ;;
  status)
    docker compose ps
    if docker compose ps db | grep -qw healthy; then
      log "db: healthy"
    else
      err "db: not healthy"
    fi
    code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login || true)"
    log "app: HTTP $code on :3000"
    ;;
  logs)
    if [ $# -ge 2 ]; then docker compose logs --tail=100 "$2"; else docker compose logs --tail=100; fi
    ;;
  *)
    echo "Usage: $0 {up|down|restart [service]|ps|status|logs [service]}"
    exit 1
    ;;
esac
