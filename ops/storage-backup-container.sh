#!/bin/sh
set -eu

RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_NAME="erp-pedro-files-${TIMESTAMP}.tar.gz"
CHECKSUM_NAME="${ARCHIVE_NAME}.sha256"
ARCHIVE="/backups/${ARCHIVE_NAME}"

mkdir -p /backups

tar -czf "${ARCHIVE}" -C /data .

cd /backups
sha256sum "${ARCHIVE_NAME}" > "${CHECKSUM_NAME}"

find /backups -type f -name 'erp-pedro-files-*.tar.gz' -mtime "+${RETENTION_DAYS}" -exec rm -f {} \;
find /backups -type f -name 'erp-pedro-files-*.tar.gz.sha256' -mtime "+${RETENTION_DAYS}" -exec rm -f {} \;

printf 'Backup de arquivos concluído: %s\n' "${ARCHIVE}"
printf 'Checksum SHA-256: /backups/%s\n' "${CHECKSUM_NAME}"
