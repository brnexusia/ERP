# Arquitetura — ERP Pedro

## Decisões iniciais

### Aplicação
- Next.js + React + TypeScript.
- Arquitetura modular por domínio.
- Core de negócio independente de n8n e de integrações externas.

### Dados
- PostgreSQL como banco principal.
- Prisma ORM.
- Multiempresa obrigatória desde a primeira migration.
- IDs internos opacos (`cuid`).
- Auditoria para ações relevantes.

### Isolamento multiempresa
Toda tabela operacional futura deve conter `organizationId` ou ser ligada a uma entidade que o contenha de forma inequívoca.

Regras:
1. O tenant ativo é resolvido no servidor.
2. O cliente nunca envia um `organizationId` confiável para autorizar acesso.
3. Toda consulta operacional deve ser filtrada pelo tenant ativo.
4. Restrições únicas que variam por empresa devem ser compostas com `organizationId`.
5. Integrações e configurações são isoladas por empresa.
6. Arquivos privados também são isolados pelo tenant ativo e não podem ser lidos ou removidos por outra empresa.

### Acesso
Modelo inicial:
- `User`: identidade do usuário.
- `Organization`: empresa/tenant.
- `Membership`: vínculo usuário ↔ empresa + papel.

Papéis iniciais:
- OWNER
- ADMIN
- MANAGER
- SELLER
- FINANCE
- SUPPORT
- VIEWER

Esses papéis são a fundação; permissões mais granulares podem ser adicionadas sem quebrar o modelo.

A autorização é aplicada no servidor. O fato de uma interface esconder uma ação não é suficiente para autorizá-la.

### Auditoria
`AuditLog` registra, no mínimo:
- empresa;
- usuário, quando existir;
- ação;
- entidade afetada;
- identificador da entidade;
- metadados úteis;
- data/hora.

A consulta administrativa dos logs também é tenant-scoped e exige `organization:manage`. Usuários operacionais não recebem acesso ao histórico administrativo apenas por estarem autenticados.

### Armazenamento de arquivos
O ERP possui armazenamento persistente separado do banco para fotos de produto, comprovantes e arquivos da operação.

Regras atuais:
- raiz configurável por `STORAGE_ROOT`;
- volume persistente próprio em produção;
- chaves físicas particionadas por empresa;
- URLs de arquivo utilizam token HMAC assinado com `FILE_TOKEN_SECRET`;
- `PRODUCT_IMAGE` pode ser publicado explicitamente para alimentar catálogo/imagens;
- `DELIVERY_PROOF` e `CLIENT_FILE` são obrigatoriamente privados;
- arquivo privado exige sessão, tenant correto e permissão de leitura coerente com sua finalidade;
- remoção exige permissão de escrita coerente com a finalidade;
- tipos executáveis não previstos não são aceitos;
- PNG/JPEG/GIF/WebP/PDF possuem validação de assinatura de conteúdo além do MIME declarado;
- upload e remoção deixam trilha de auditoria;
- arquivo criado no disco é removido se a auditoria do upload não puder ser persistida.

Banco e armazenamento fazem parte do mesmo estado recuperável do produto. Backup completo exige PostgreSQL + volume de arquivos.

### Segurança HTTP e saúde
A aplicação define cabeçalhos HTTP básicos de endurecimento (`nosniff`, frame deny, referrer policy, permissions policy e COOP). HSTS/TLS permanecem responsabilidade do ambiente HTTPS definitivo para não serem ativados incorretamente em desenvolvimento.

O healthcheck verifica não apenas o PostgreSQL, mas também se o diretório de armazenamento persistente está acessível para leitura/escrita.

### Integrações
Integrações externas entram por adaptadores. O domínio do ERP não deve depender diretamente de VaxChat, VaxLab, WhatsApp, GoPage, ShopVax, gateways ou n8n.

Segredos não devem ser persistidos em texto puro. O banco pode armazenar apenas referências/configurações não sensíveis; credenciais devem ficar em variáveis de ambiente ou serviço de secrets.

## Estrutura de diretórios alvo

```text
app/                 # rotas e interface
components/          # componentes compartilhados
modules/             # domínios do ERP
  auth/
  organizations/
  clients/
  crm/
  sales/
  sellers/
  products/
  inventory/
  commissions/
  finance/
  integrations/
  storage/
  audit/
lib/                 # infraestrutura compartilhada
prisma/              # schema e migrations
ops/                 # backup, restore e operação de produção
docs/                # decisões, progresso e documentação
```

## Regra visual
O código visual definitivo só deve ser fechado quando houver referência suficiente do Stitch. Não inventar design para telas que já possuem fonte oficial. Para telas novas, reutilizar o design system aprovado.
