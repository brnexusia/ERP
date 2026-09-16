#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_NAME="${1:-}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"

if [[ -z "${ARCHIVE_NAME}" ]]; then
  printf 'Uso: CONFIRM_RESTORE=YES %s <arquivo.dump>\n' "$0" >&2
  exit 1
fi

case "${ARCHIVE_NAME}" in
  */*|*..*)
    printf 'Informe apenas o nome do arquivo dentro de ./backups.\n' >&2
    exit 1
    ;;
esac

if [[ ! -f "./backups/${ARCHIVE_NAME}" ]]; then
  printf 'Arquivo de backup não encontrado: ./backups/%s\n' "${ARCHIVE_NAME}" >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  printf 'Restore PostgreSQL é destrutivo. Execute novamente com CONFIRM_RESTORE=YES após validar o backup selecionado.\n' >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  printf 'Arquivo de ambiente não encontrado: %s\n' "${ENV_FILE}" >&2
  exit 1
fi

RESTORE_ARCHIVE="${ARCHIVE_NAME}" \
ALLOW_UNVERIFIED_BACKUP="${ALLOW_UNVERIFIED_BACKUP:-}" \
docker compose \
  --env-file "${ENV_FILE}" \
  -f "${COMPOSE_FILE}" \
  --profile ops \
  run --rm postgres-restore
