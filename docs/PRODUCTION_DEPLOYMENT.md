# Produção em VPS — ERP Pedro

## Estado

A estrutura de deploy está preparada no repositório, mas **nenhum ambiente de produção é considerado configurado** enquanto VPS, domínio, DNS/TLS e variáveis reais não forem fornecidos e validados.

O documento-fonte exige VPS/ambiente de produção, banco/armazenamento, segurança de acesso, backup/recuperação, domínio e arquitetura preparada para crescimento e múltiplas empresas. Este procedimento prepara a aplicação e o PostgreSQL para esse ambiente sem escolher silenciosamente um provedor ou domínio.

## Arquivos

- `Dockerfile` — imagem da aplicação;
- `docker-compose.production.yml` — aplicação + PostgreSQL persistente;
- `.env.production.example` — modelo de variáveis, sem segredos reais;
- `ops/backup-postgres.sh` — backup;
- `ops/restore-postgres.sh` — recuperação;
- `/api/health` — healthcheck da aplicação.

## Princípios de produção

- O PostgreSQL fica apenas na rede interna do Docker e não publica a porta 5432 na internet.
- A aplicação publica por padrão apenas `127.0.0.1:3000`, para ficar atrás de proxy reverso/TLS no host.
- Migrations versionadas são aplicadas antes da inicialização da aplicação.
- Dados do PostgreSQL ficam em volume persistente.
- `.env.production` é arquivo local do servidor e não deve ser commitado.
- Senhas e referências de segredo das integrações não devem ser colocadas no repositório.

## Preparação do servidor

Pré-requisitos mínimos:

- Linux atualizado;
- Docker Engine;
- Docker Compose v2;
- firewall permitindo apenas o necessário para SSH, HTTP e HTTPS;
- espaço persistente para banco e backups;
- usuário operacional sem depender de login root para rotina diária.

## Primeiro deploy

1. Clonar o repositório no servidor.
2. Copiar `.env.production.example` para `.env.production`.
3. Substituir todos os valores de exemplo por valores reais e seguros.
4. Garantir que `DATABASE_URL` use o hostname interno `postgres` e corresponda ao usuário/senha/database definidos para o container PostgreSQL.
5. Construir e iniciar:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

6. Conferir estado:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

7. Conferir healthcheck local:

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

## Domínio e HTTPS

O domínio definitivo ainda não foi definido no documento técnico disponível. Quando houver domínio aprovado:

1. apontar DNS para o IP público da VPS;
2. instalar/configurar proxy reverso no host ou serviço equivalente;
3. encaminhar HTTPS para `127.0.0.1:APP_PORT`;
4. emitir/renovar certificado TLS;
5. atualizar `APP_URL` para a URL HTTPS definitiva;
6. validar cookies, autenticação, APIs e callbacks/webhooks das integrações no endereço definitivo.

Não se deve expor diretamente a porta do PostgreSQL ou tratar o endereço provisório da VPS como domínio final.

## Backup e recuperação

A presença do script de backup não substitui a execução programada. Antes de considerar produção homologada é obrigatório:

- definir periodicidade;
- definir retenção;
- guardar cópia fora do mesmo volume/VPS;
- executar pelo menos um teste de restore em ambiente isolado;
- registrar data e resultado do teste de recuperação.

## Checklist antes de liberar uso real

- CI da versão a implantar em sucesso;
- migrations aplicadas sem erro;
- healthcheck saudável;
- login e isolamento multiempresa testados;
- permissões revisadas;
- banco não exposto publicamente;
- TLS ativo;
- backup automatizado;
- restore testado;
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
- armazenamento externo de arquivos, caso seja necessário além do servidor;
- política final de retenção de backup.

Esses itens devem ser preenchidos no momento da implantação real, sem alterar as regras funcionais do ERP.
