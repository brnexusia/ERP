#!/bin/sh
set -eu

RESTORE_ARCHIVE="${RESTORE_ARCHIVE:-}"
ALLOW_UNVERIFIED_BACKUP="${ALLOW_UNVERIFIED_BACKUP:-}"

if [ -z "${RESTORE_ARCHIVE}" ]; then
  printf 'RESTORE_ARCHIVE não definido\n' >&2
  exit 1
fi

case "${RESTORE_ARCHIVE}" in
  */*|*..*)
    printf 'Nome de arquivo de restore inválido\n' >&2
    exit 1
    ;;
esac

ARCHIVE="/backups/${RESTORE_ARCHIVE}"
CHECKSUM_NAME="${RESTORE_ARCHIVE}.sha256"
CHECKSUM="/backups/${CHECKSUM_NAME}"

if [ ! -f "${ARCHIVE}" ]; then
  printf 'Backup não encontrado: %s\n' "${ARCHIVE}" >&2
  exit 1
fi

if [ -f "${CHECKSUM}" ]; then
  cd /backups
  sha256sum -c "${CHECKSUM_NAME}"
elif [ "${ALLOW_UNVERIFIED_BACKUP}" != "YES" ]; then
  printf 'Checksum não encontrado: %s\n' "${CHECKSUM}" >&2
  printf 'Restore bloqueado. Para backup legado revisado, use ALLOW_UNVERIFIED_BACKUP=YES explicitamente.\n' >&2
  exit 1
fi

# Valida o arquivo antes de remover qualquer conteúdo atual.
tar -tzf "${ARCHIVE}" >/dev/null

find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} \;
tar -xzf "${ARCHIVE}" -C /data

printf 'Restauração de arquivos concluída: %s\n' "${ARCHIVE}"
