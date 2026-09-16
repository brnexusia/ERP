# Produção em VPS — ERP Pedro

## Estado

A estrutura de deploy está preparada no repositório, mas **nenhum ambiente de produção é considerado configurado** enquanto VPS, domínio, DNS/TLS e variáveis reais não forem fornecidos e validados.

O documento-fonte exige VPS/ambiente de produção, banco/armazenamento, segurança de acesso, backup/recuperação, domínio e arquitetura preparada para crescimento e múltiplas empresas. Este procedimento prepara a aplicação, o PostgreSQL e o armazenamento persistente de arquivos para esse ambiente sem escolher silenciosamente um provedor ou domínio.

## Arquivos

- `Dockerfile` — imagem da aplicação;
- `docker-compose.production.yml` — aplicação + PostgreSQL + volume persistente de arquivos;
- `.env.production.example` — modelo de variáveis, sem segredos reais;
- `ops/backup-postgres.sh` — backup do PostgreSQL;
- `ops/restore-postgres.sh` — recuperação do PostgreSQL;
- `ops/backup-storage.sh` — backup do volume persistente de arquivos;
- `ops/restore-storage.sh` — recuperação protegida do volume persistente de arquivos;
- `/api/health` — healthcheck da aplicação.

## Princípios de produção

- O PostgreSQL fica apenas na rede interna do Docker e não publica a porta 5432 na internet.
- A aplicação publica por padrão apenas `127.0.0.1:3000`, para ficar atrás de proxy reverso/TLS no host.
- Migrations versionadas são aplicadas antes da inicialização da aplicação.
- Dados do PostgreSQL ficam em volume persistente.
- Arquivos enviados pelo ERP ficam em volume persistente separado (`file_storage`).
- Arquivos privados exigem sessão e tenant correto; arquivos marcados explicitamente como públicos podem alimentar catálogo/imagens públicas.
- Tokens de arquivo são assinados com `FILE_TOKEN_SECRET`; produção exige segredo com pelo menos 32 caracteres.
- Backups novos de banco e arquivos recebem checksum SHA-256; o restore valida a integridade antes de substituir dados.
- `.env.production` é arquivo local do servidor e não deve ser commitado.
- Senhas, `FILE_TOKEN_SECRET` e referências de segredo das integrações não devem ser colocadas no repositório.

## Preparação do servidor

Pré-requisitos mínimos:

- Linux atualizado;
- Docker Engine;
- Docker Compose v2;
- firewall permitindo apenas o necessário para SSH, HTTP e HTTPS;
- espaço persistente para banco, arquivos e backups;
- usuário operacional sem depender de login root para rotina diária.

## Primeiro deploy

1. Clonar o repositório no servidor.
2. Copiar `.env.production.example` para `.env.production`.
3. Substituir todos os valores de exemplo por valores reais e seguros.
4. Garantir que `DATABASE_URL` use o hostname interno `postgres` e corresponda ao usuário/senha/database definidos para o container PostgreSQL.
5. Gerar um `FILE_TOKEN_SECRET` aleatório e forte com pelo menos 32 caracteres; não reutilizar senha de banco.
6. Construir e iniciar:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

7. Conferir estado:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

8. Conferir healthcheck local:

```bash
curl -fsS http://127.0.0.1:${APP_PORT:-3000}/api/health
```

## Bootstrap inicial

Em instalação totalmente vazia, o seed existente pode criar o primeiro tenant/administrador configurado no ambiente. Para novas empresas adicionais, deve ser usado o provisionamento controlado documentado em `docs/PROVISIONING.md`, evitando reexecutar seed como mecanismo de criação comercial de contas.

Exemplo de seed inicial:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec app pnpm db:seed
```

## Atualização

Procedimento mínimo:

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

A imagem executa `prisma migrate deploy` antes do `next start`. Uma atualização com migration inválida deve impedir a nova aplicação de iniciar em vez de ignorar o problema de banco.

O volume `file_storage` não é recriado em rebuild normal. Atualizar a imagem da aplicação, portanto, não deve apagar fotos, comprovantes ou arquivos enviados pelo ERP.

## Domínio e HTTPS

O domínio definitivo ainda não foi definido no documento técnico disponível. Quando houver domínio aprovado:

1. apontar DNS para o IP público da VPS;
2. instalar/configurar proxy reverso no host ou serviço equivalente;
3. encaminhar HTTPS para `127.0.0.1:APP_PORT`;
4. emitir/renovar certificado TLS;
5. atualizar `APP_URL` para a URL HTTPS definitiva;
6. validar cookies, autenticação, URLs dos arquivos públicos/privados, APIs e callbacks/webhooks das integrações no endereço definitivo.

Não se deve expor diretamente a porta do PostgreSQL ou tratar o endereço provisório da VPS como domínio final.

## Armazenamento de arquivos

O endpoint autenticado `POST /api/files` recebe `multipart/form-data` e exige:

- `file` — arquivo;
- `purpose` — `PRODUCT_IMAGE`, `DELIVERY_PROOF`, `CLIENT_FILE` ou `OTHER`;
- `visibility` — `public` ou `private`.

O limite técnico padrão é 25 MiB (`MAX_UPLOAD_BYTES`) e pode ser ajustado no ambiente. Tipos executáveis como HTML não são aceitos. A permissão de upload é derivada da finalidade do arquivo:

- imagem de produto → `inventory:write`;
- comprovante de entrega → `sales:write`;
- arquivo de cliente → `clients:write`;
- outros arquivos → uma permissão operacional de escrita/gestão compatível.

Arquivos privados são servidos por rota autenticada e não ficam acessíveis a outro tenant. Arquivos públicos são expostos apenas quando o upload foi marcado explicitamente como público. Upload e remoção deixam trilha no `AuditLog`.

## Backup do PostgreSQL

Os scripts genéricos continuam disponíveis:

```bash
DATABASE_URL="..." ./ops/backup-postgres.sh
```

Cada backup novo gera dois arquivos correspondentes:

- `erp-pedro-YYYYMMDDTHHMMSSZ.dump`
- `erp-pedro-YYYYMMDDTHHMMSSZ.dump.sha256`

O checksum é calculado somente depois que o `pg_dump` termina. Para restore:

```bash
DATABASE_URL="..." BACKUP_FILE="./backups/erp-pedro-....dump" ./ops/restore-postgres.sh
```

Antes do `pg_restore`, o script valida o `.sha256`. Se o checksum divergir, o restore para antes de alterar o banco. Um backup legado sem checksum também é bloqueado por padrão; somente após revisão explícita pode ser usado com `ALLOW_UNVERIFIED_BACKUP=YES`.

O restore deve ser feito em janela controlada, preferencialmente com a aplicação parada ou sem escrita concorrente.

## Backup do armazenamento de arquivos

A stack de produção contém um serviço operacional isolado que monta o volume `file_storage` somente para backup.

```bash
./ops/backup-storage.sh
```

Cada execução cria em `./backups`:

- `erp-pedro-files-YYYYMMDDTHHMMSSZ.tar.gz`
- `erp-pedro-files-YYYYMMDDTHHMMSSZ.tar.gz.sha256`

A retenção padrão é de 14 dias e pode ser alterada por `RETENTION_DAYS`. O arquivo de checksum segue a mesma política de retenção do backup correspondente.

## Restore do armazenamento de arquivos

O restore é destrutivo para o conteúdo atual do volume e exige confirmação explícita. Antes de limpar o volume, o serviço verifica o checksum SHA-256 e também valida que o arquivo é um `tar.gz` legível.

```bash
CONFIRM_RESTORE=YES ./ops/restore-storage.sh erp-pedro-files-YYYYMMDDTHHMMSSZ.tar.gz
```

Backup legado sem `.sha256` é rejeitado por padrão. Se houver um caso excepcional previamente revisado, o operador precisa habilitar explicitamente `ALLOW_UNVERIFIED_BACKUP=YES` junto da confirmação de restore.

Antes de restaurar em produção:

1. confirmar que o arquivo selecionado é o correto;
2. confirmar que o checksum correspondente está presente e válido;
3. criar um backup do estado atual;
4. parar ou bloquear uploads durante a restauração;
5. validar após o restore pelo menos uma imagem pública e um arquivo privado autenticado.

## Política de backup e recuperação

A presença dos scripts não substitui a execução programada. Antes de considerar produção homologada é obrigatório:

- definir periodicidade para PostgreSQL e `file_storage`;
- definir retenção;
- guardar cópia fora do mesmo volume/VPS;
- preservar arquivo e checksum correspondente no destino offsite;
- executar pelo menos um teste de restore do banco em ambiente isolado;
- executar pelo menos um teste de restore do volume de arquivos;
- registrar data e resultado dos testes de recuperação.

Banco e arquivos fazem parte do mesmo produto. Um backup de banco sem as fotos/comprovantes correspondentes não representa recuperação completa do ERP. O checksum detecta corrupção/alteração do arquivo, mas não substitui teste real de restauração.

## Checklist antes de liberar uso real

- CI da versão a implantar em sucesso;
- migrations aplicadas sem erro;
- healthcheck saudável;
- login e isolamento multiempresa testados;
- permissões revisadas;
- banco não exposto publicamente;
- volume de arquivos persistente montado;
- `FILE_TOKEN_SECRET` real e fora do Git;
- arquivo privado bloqueado sem sessão e entre tenants;
- TLS ativo;
- backup de banco automatizado;
- backup do `file_storage` automatizado;
- checksums de banco e arquivos gerados e preservados;
- restore de banco testado;
- restore de arquivos testado;
- domínio/APP_URL corretos;
- credenciais reais fora do Git;
- integrações externas homologadas individualmente quando forem ativadas.

## O que ainda depende de dados externos

Este repositório não escolhe por conta própria:

- provedor/IP da VPS;
- domínio final;
- configuração DNS;
- provedor de proxy/TLS, se houver preferência operacional;
- conta/e-mail empresarial;
- armazenamento externo de arquivos, caso seja necessário além do volume persistente da VPS;
- política final de retenção/offsite dos backups.

Esses itens devem ser preenchidos no momento da implantação real, sem alterar as regras funcionais do ERP.
