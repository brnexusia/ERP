# Produção e recuperação — ERP Pedro

Este documento define a base operacional do Progresso 1. Ele não substitui a configuração final da VPS; registra a arquitetura mínima que a produção deve respeitar.

## Topologia mínima

- aplicação Next.js executada em processo/container separado;
- PostgreSQL 17 persistente, sem exposição pública direta;
- proxy reverso com HTTPS;
- domínio próprio apontando para o proxy;
- variáveis e segredos fora do repositório;
- storage externo/S3-compatible para arquivos quando o módulo de produtos entrar;
- migrations executadas com `pnpm db:deploy` antes da nova versão assumir tráfego.

## Segredos

Nunca versionar `.env` real, senhas, tokens de APIs ou credenciais de banco. O repositório contém apenas `.env.example`.

Segredos mínimos de produção:

- `DATABASE_URL`;
- credenciais do primeiro administrador somente durante provisionamento;
- credenciais futuras das integrações, preferencialmente em serviço de secrets.

## Backups

Política inicial:

- backup completo do PostgreSQL diariamente;
- retenção local curta (padrão do script: 14 dias);
- cópia externa/criptografada obrigatória em produção;
- teste de restauração periódico em banco separado;
- nunca considerar backup válido sem teste de restore.

Execução:

```bash
DATABASE_URL='postgresql://...' BACKUP_DIR='/backups/erp' ./ops/backup-postgres.sh
```

Restauração controlada:

```bash
DATABASE_URL='postgresql://...' BACKUP_FILE='/backups/erp/arquivo.dump' ./ops/restore-postgres.sh
```

A restauração usa `--clean --if-exists`; portanto deve ser executada somente em ambiente explicitamente escolhido para recuperação.

## Agenda recomendada

Cron diário de backup em horário de baixa utilização e sincronização do arquivo para storage externo. Em produção, o cron deve registrar sucesso/falha e gerar alerta em caso de erro.

## Deploy seguro

1. gerar backup antes de migration de risco;
2. subir nova imagem/versão da aplicação;
3. executar `pnpm db:deploy`;
4. validar healthcheck e login;
5. liberar tráfego;
6. manter rollback da versão anterior disponível.

## Recuperação

Em incidente de dados:

1. interromper gravações quando necessário;
2. preservar o banco atual antes de qualquer restauração;
3. restaurar o último backup em instância separada;
4. validar integridade, tenants e usuários;
5. somente então decidir troca do banco de produção.

## Isolamento multiempresa

Backup e restauração são do banco completo. O isolamento entre empresas continua sendo responsabilidade das relações `organizationId` e das consultas do servidor. Nunca exportar dados de um cliente usando consultas sem filtro de tenant.
