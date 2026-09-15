# Progresso — ERP Pedro

Estados permitidos:
- ⬜ Não iniciado
- 🟡 Em construção
- 🟠 Funcional
- 🔵 Em homologação
- ✅ Fechado

## Marcos

| # | Progresso | Estado |
|---|---|---|
| 1 | Fundação do sistema | ✅ Fechado |
| 2 | Design system + estrutura visual | 🟡 Em construção |
| 3 | Gestão de Clientes | 🟡 Em construção |
| 4 | Crédito, Vale e CRM | ⬜ Não iniciado |
| 5 | Produtos e estrutura de estoque | ⬜ Não iniciado |
| 6 | Estoque inteligente | ⬜ Não iniciado |
| 7 | Fluxo comercial | ⬜ Não iniciado |
| 8 | Pagamentos e entrega | ⬜ Não iniciado |
| 9 | Vendedoras, metas e comissões | ⬜ Não iniciado |
| 10 | Relatórios e dashboards | ⬜ Não iniciado |
| 11 | Financeiro | ⬜ Não iniciado |
| 12 | Promoções e catálogo | ⬜ Não iniciado |
| 13 | Integrações | ⬜ Não iniciado |
| 14 | Preparação como produto | ⬜ Não iniciado |
| 15 | Homologação final | ⬜ Não iniciado |

## Progresso 1 — Fundação do sistema ✅

- [x] Repositório oficial identificado e inicializado.
- [x] Arquitetura-base documentada.
- [x] Estratégia multiempresa definida.
- [x] Regra de isolamento de dados definida.
- [x] Aplicação Next.js/TypeScript criada.
- [x] PostgreSQL reproduzível configurado.
- [x] Prisma configurado.
- [x] Migration inicial versionada e aplicada em PostgreSQL real de CI.
- [x] Modelos base de empresa, usuário, membership, sessão, integração e auditoria.
- [x] Autenticação implementada com senha scrypt e sessão persistida.
- [x] Logout com invalidação da sessão.
- [x] Controle de tenant e troca segura de empresa implementados.
- [x] Matriz inicial de papéis e permissões implementada.
- [x] Helpers de acesso tenant-scoped criados.
- [x] Rota raiz protegida e tela provisória de login criada.
- [x] Seletor provisório de empresa conectado à autorização do servidor.
- [x] Seed do primeiro tenant/administrador executado em CI.
- [x] Teste real de isolamento A/B entre duas empresas.
- [x] Tentativa de troca para empresa sem membership bloqueada com 403.
- [x] Build e typecheck executados com sucesso.
- [x] Smoke test HTTP de login, navegação, troca de empresa e logout executado com sucesso.
- [x] Healthcheck do banco/aplicação criado.
- [x] Estrutura de produção, backup e recuperação documentada.
- [x] Scripts de backup e restore do PostgreSQL criados.

### Evidência de fechamento

O workflow `ERP CI` executa PostgreSQL real em container, migration versionada, seed, teste de isolamento multiempresa, matriz de permissões, typecheck, build e smoke test HTTP da aplicação. O run 20 (`35026877272`) terminou com todos os passos em sucesso.

## Progresso 2 — Design system + estrutura visual 🟡

Fonte obrigatória: Stitch aprovado. O documento oficial disponível confirma que devem ser reproduzidos fielmente estrutura de páginas/sidebar, cabeçalhos, cards, dashboards, tabelas, gráficos, cores, tipografia, espaçamentos, botões, ícones, campos, filtros, modais, estados e responsividade.

Telas explicitamente indicadas como já desenhadas no Stitch:
- Dashboard Geral;
- Clientes & CRM;
- Produtos & Estoque;
- design system do ERP.

Regra deste progresso: não converter a tela provisória atual em design definitivo a partir de interpretação. Os valores visuais finais só entram a partir de referência suficientemente detalhada do Stitch.

### Critério de fechamento do Progresso 2

O marco vira ✅ quando shell global, sidebar, cabeçalho e componentes compartilhados estiverem implementados e comparados com a fonte oficial do Stitch, incluindo estados e responsividade relevantes.

## Progresso 3 — Gestão de Clientes 🟡

Base funcional implementada sem inventar o visual definitivo:

- [x] Modelo `Client` isolado por empresa.
- [x] Endereço completo em entidade própria e isolada por empresa.
- [x] CPF/CNPJ normalizado, classificado e validado.
- [x] CPF/CNPJ único dentro de cada empresa e permitido entre empresas distintas.
- [x] WhatsApp normalizado.
- [x] E-mail validado.
- [x] Listagem de clientes por tenant.
- [x] Consulta individual por tenant.
- [x] Cadastro de cliente.
- [x] Atualização de cliente e endereço.
- [x] Auditoria de criação e atualização.
- [x] Permissões `clients:read` e `clients:write` aplicadas.
- [x] API bloqueia acesso cruzado entre empresas.
- [x] Migration de clientes aplicada com sucesso.
- [x] Smoke test real da API passou em PostgreSQL: criar, consultar, atualizar, listar, bloquear duplicidade interna e bloquear acesso cross-tenant.
- [ ] Tela de listagem conforme Stitch.
- [ ] Tela/formulário de cadastro conforme Stitch.
- [ ] Tela de detalhe/edição conforme Stitch.
- [ ] Histórico de compras conectado ao fluxo comercial quando o Progresso 7 existir.

### Evidência atual

O run 31 (`35027529904`) concluiu com sucesso migration, seed, isolamento, typecheck, build e smoke test HTTP incluindo as operações de clientes.

### Critério de fechamento do Progresso 3

Só vira ✅ quando cadastro, consulta, edição, endereço e histórico de compras estiverem funcionais na interface fiel ao Stitch e mantiverem o isolamento multiempresa já validado no backend.
