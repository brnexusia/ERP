#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
RESTORE_ARCHIVE="${RESTORE_ARCHIVE:-${1:-}}"

if [[ ! -f "${ENV_FILE}" ]]; then
  printf 'Arquivo de ambiente não encontrado: %s\n' "${ENV_FILE}" >&2
  exit 1
fi

if [[ -z "${RESTORE_ARCHIVE}" ]]; then
  printf 'Informe RESTORE_ARCHIVE ou passe o nome do arquivo como primeiro argumento.\n' >&2
  exit 1
fi

RESTORE_ARCHIVE="$(basename -- "${RESTORE_ARCHIVE}")"
if [[ ! -f "backups/${RESTORE_ARCHIVE}" ]]; then
  printf 'Backup de arquivos não encontrado: backups/%s\n' "${RESTORE_ARCHIVE}" >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  printf 'Restauração bloqueada. Execute com CONFIRM_RESTORE=YES após confirmar que o backup correto foi selecionado.\n' >&2
  exit 1
fi

RESTORE_ARCHIVE="${RESTORE_ARCHIVE}" docker compose \
  --env-file "${ENV_FILE}" \
  -f "${COMPOSE_FILE}" \
  --profile ops \
  run --rm storage-restore
