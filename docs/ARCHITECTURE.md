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

### Auditoria
`AuditLog` registra, no mínimo:
- empresa;
- usuário, quando existir;
- ação;
- entidade afetada;
- identificador da entidade;
- metadados úteis;
- data/hora.

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
  products/
  inventory/
  commissions/
  finance/
  integrations/
lib/                 # infraestrutura compartilhada
prisma/              # schema e migrations
docs/                # decisões, progresso e documentação
```

## Regra visual
O código visual definitivo só deve ser fechado quando houver referência suficiente do Stitch. Não inventar design para telas que já possuem fonte oficial. Para telas novas, reutilizar o design system aprovado.
