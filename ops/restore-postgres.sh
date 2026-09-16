#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL não definida}"
: "${BACKUP_FILE:?BACKUP_FILE não definido}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  printf 'Arquivo de backup não encontrado: %s\n' "${BACKUP_FILE}" >&2
  exit 1
fi

CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [[ -f "${CHECKSUM_FILE}" ]]; then
  (
    cd "$(dirname -- "${BACKUP_FILE}")"
    sha256sum -c "$(basename -- "${CHECKSUM_FILE}")"
  )
elif [[ "${ALLOW_UNVERIFIED_BACKUP:-}" != "YES" ]]; then
  printf 'Checksum não encontrado: %s\n' "${CHECKSUM_FILE}" >&2
  printf 'Restore bloqueado. Para um backup legado sem checksum, revise o arquivo e use ALLOW_UNVERIFIED_BACKUP=YES explicitamente.\n' >&2
  exit 1
fi

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="${DATABASE_URL}" \
  "${BACKUP_FILE}"

printf 'Restauração concluída a partir de: %s\n' "${BACKUP_FILE}"
