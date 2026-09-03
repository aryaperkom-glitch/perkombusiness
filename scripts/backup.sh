#!/usr/bin/env bash
# Backup database + uploaded files, with retention, verification, replication.
#
#   ./scripts/backup.sh                     run backup now
#   ./scripts/backup.sh verify              validate existing backup files
#   ./scripts/backup.sh list                list backups
#   ./scripts/backup.sh restore-db <file>   restore (asks for confirmation)
#   ./scripts/backup.sh install-cron        daily 02:17 backup via crontab
#
# Configure in .env (optional): RETENTION_DAYS=14, BACKUP_REMOTE=user@host:/path
set -euo pipefail
. "$(dirname "$0")/_common.sh"

RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
DB_DIR=storage/backups/database
FILES_DIR=storage/backups/files

cmd="${1:-run}"
case "$cmd" in
  run)
    lock storage/backups/.backup.lock
    mkdir -p "$DB_DIR" "$FILES_DIR" storage/uploads
    stamp="$(date +%Y-%m-%d_%H%M%S)"

    log "backing up database..."
    dbfile="$DB_DIR/db-$stamp.sql.gz"
    docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip -9 > "$dbfile"
    [ -s "$dbfile" ] || { err "database backup is empty"; exit 1; }
    gzip -t "$dbfile"
    log "database OK: $dbfile ($(du -h "$dbfile" | cut -f1))"

    log "backing up uploaded files..."
    if [ -n "$(ls -A storage/uploads 2>/dev/null)" ]; then
      filesfile="$FILES_DIR/files-$stamp.tar.gz"
      # -C storage uploads: archives storage/uploads only — never storage/backups
      tar -czf "$filesfile" -C storage uploads
      gzip -t "$filesfile"
      log "files OK: $filesfile ($(du -h "$filesfile" | cut -f1))"
    else
      log "storage/uploads is empty — files backup skipped"
    fi

    log "retention: deleting backups older than ${RETENTION_DAYS} days"
    find "$DB_DIR" -type f -name 'db-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
    find "$FILES_DIR" -type f -name 'files-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

    if [ -n "$BACKUP_REMOTE" ]; then
      command -v rsync >/dev/null || { err "BACKUP_REMOTE is set but rsync is not installed"; exit 1; }
      log "replicating backups to $BACKUP_REMOTE ..."
      rsync -a storage/backups/ "$BACKUP_REMOTE"
    else
      log "replication disabled (set BACKUP_REMOTE in .env to enable)"
    fi
    log "backup complete."
    ;;

  verify)
    fail=0
    for f in "$DB_DIR"/db-*.sql.gz; do
      [ -e "$f" ] || continue
      if [ -s "$f" ] && gzip -t "$f" 2>/dev/null; then
        log "OK  $f ($(du -h "$f" | cut -f1))"
      else
        err "CORRUPT $f"
        fail=1
      fi
    done
    for f in "$FILES_DIR"/files-*.tar.gz; do
      [ -e "$f" ] || continue
      if [ -s "$f" ] && gzip -t "$f" 2>/dev/null && tar -tzf "$f" >/dev/null 2>&1; then
        log "OK  $f ($(du -h "$f" | cut -f1))"
      else
        err "CORRUPT $f"
        fail=1
      fi
    done
    [ "$fail" = 0 ] && log "all backups valid." || { err "one or more backups are corrupt"; exit 1; }
    ;;

  list)
    ls -lh "$DB_DIR" 2>/dev/null || log "no database backups yet"
    ls -lh "$FILES_DIR" 2>/dev/null || log "no file backups yet"
    ;;

  restore-db)
    file="${2:?Usage: ./scripts/backup.sh restore-db <db-....sql.gz>}"
    [ -f "$file" ] || { err "backup file not found: $file"; exit 1; }
    tables="$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
    log "current database has $tables public tables"
    echo "WARNING: restore DROPs the public schema and restores from the backup."
    echo "         Current data will be lost. This cannot be undone."
    printf "Type RESTORE to continue: "
    read -r answer
    [ "$answer" = "RESTORE" ] || { log "aborted."; exit 1; }
    log "restoring $file ..."
    docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
      -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    gzip -dc "$file" | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
    log "restore finished. Verify with: ./scripts/docker.sh status"
    ;;

  install-cron)
    command -v crontab >/dev/null || { err "crontab is not available on this system"; exit 1; }
    if (crontab -l 2>/dev/null || true) | grep -q 'officeless-backup'; then
      log "backup cron is already installed."
      exit 0
    fi
    entry="17 2 * * * cd $ROOT && ./scripts/backup.sh >> $ROOT/storage/backups/backup.log 2>&1  # officeless-backup"
    (crontab -l 2>/dev/null || true; echo "$entry") | crontab -
    log "installed daily 02:17 backup job (log: storage/backups/backup.log)"
    ;;

  *)
    echo "Usage: $0 {run|verify|list|restore-db <file>|install-cron}"
    exit 1
    ;;
esac
