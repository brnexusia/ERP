#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"

if [[ ! -f "${ENV_FILE}" ]]; then
  printf 'Arquivo de ambiente não encontrado: %s\n' "${ENV_FILE}" >&2
  exit 1
fi

mkdir -p ./backups

docker compose \
  --env-file "${ENV_FILE}" \
  -f "${COMPOSE_FILE}" \
  --profile ops \
  run --rm postgres-backup
