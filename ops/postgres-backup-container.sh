#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER não definido}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD não definido}"
: "${POSTGRES_DB:?POSTGRES_DB não definido}"

RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_NAME="erp-pedro-${TIMESTAMP}.dump"
CHECKSUM_NAME="${ARCHIVE_NAME}.sha256"
ARCHIVE="/backups/${ARCHIVE_NAME}"

mkdir -p /backups

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  --host=postgres \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="${ARCHIVE}"

cd /backups
sha256sum "${ARCHIVE_NAME}" > "${CHECKSUM_NAME}"

find /backups -type f -name 'erp-pedro-*.dump' -mtime "+${RETENTION_DAYS}" -exec rm -f {} \;
find /backups -type f -name 'erp-pedro-*.dump.sha256' -mtime "+${RETENTION_DAYS}" -exec rm -f {} \;

printf 'Backup PostgreSQL concluído: %s\n' "${ARCHIVE}"
printf 'Checksum SHA-256: /backups/%s\n' "${CHECKSUM_NAME}"
