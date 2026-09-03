#!/usr/bin/env bash
# Shared helpers for the officeless ops scripts (sourced, not executed).

log() { printf '[%s] [INFO] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }
err() { printf '[%s] [ERROR] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >&2; }

# Project root = parent of the scripts/ directory
ROOT="$(cd "$(dirname "${BASH_SOURCE[1]:-$0}")/.." && pwd)"
cd "$ROOT"

# Load .env for DB identifiers / ops settings. Values are never printed.
if [ -f .env ]; then set -a; . ./.env; set +a; fi
DB_USER="${POSTGRES_USER:-officeless}"
DB_NAME="${POSTGRES_DB:-officeless}"

# Serialized runs via a lock dir (portable — no flock needed)
lock() {
  LOCK_DIR="${1:?lock dir required}"
  mkdir -p "$(dirname "$LOCK_DIR")"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    err "another run is active (lock: $LOCK_DIR). Delete it if stale."
    exit 1
  fi
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
}
