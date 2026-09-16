#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL não definida}"
: "${BACKUP_FILE:?BACKUP_FILE não definido}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  printf 'Arquivo de backup não encontrado: %s\n' "${BACKUP_FILE}" >&2
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
