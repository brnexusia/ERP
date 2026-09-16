#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL não definida}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${BACKUP_DIR}/erp-pedro-${TIMESTAMP}.dump"
CHECKSUM_FILE="${FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --dbname="${DATABASE_URL}" \
  --file="${FILE}"

(
  cd "${BACKUP_DIR}"
  sha256sum "$(basename -- "${FILE}")" > "$(basename -- "${CHECKSUM_FILE}")"
)

find "${BACKUP_DIR}" -type f -name 'erp-pedro-*.dump' -mtime "+${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}" -type f -name 'erp-pedro-*.dump.sha256' -mtime "+${RETENTION_DAYS}" -delete

printf 'Backup concluído: %s\n' "${FILE}"
printf 'Checksum SHA-256: %s\n' "${CHECKSUM_FILE}"
