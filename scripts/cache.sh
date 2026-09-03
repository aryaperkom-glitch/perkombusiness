#!/usr/bin/env bash
# Docker build-cache management.
#
#   ./scripts/cache.sh status   show Docker disk usage
#   ./scripts/cache.sh clean    remove dangling build cache only (safe)
#   ./scripts/cache.sh prune    remove ALL build cache + dangling images (aggressive)
#
# NEVER removes: volumes, storage/, .env, networks, running containers.
set -euo pipefail
. "$(dirname "$0")/_common.sh"

cmd="${1:-status}"
case "$cmd" in
  status)
    docker system df
    ;;
  clean)
    log "removing dangling build cache only (images/containers/volumes untouched)..."
    docker builder prune -f
    docker system df
    ;;
  prune)
    log "AGGRESSIVE cleanup — this removes:"
    log "  - ALL Docker build cache (next build will be slow)"
    log "  - dangling images only (tagged images in use are kept)"
    log "  it NEVER touches volumes, storage/, .env or running containers."
    docker builder prune -af
    docker image prune -f
    docker system df
    ;;
  *)
    echo "Usage: $0 {status|clean|prune}"
    exit 1
    ;;
esac
