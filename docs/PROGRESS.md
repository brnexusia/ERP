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
| 4 | Crédito, Vale e CRM | 🟡 Em construção |
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
- [x] Segmento atual exposto nas consultas de cliente.
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

## Progresso 4 — Crédito, Vale e CRM 🟡

Base funcional implementada a partir do escopo oficial da Etapa 1:

- [x] Segmentos/grupos são cadastrados por empresa.
- [x] Cliente pode ser classificado em segmento/grupo da própria empresa.
- [x] Linha de crédito por cliente com limite registrado.
- [x] Valor utilizado mantido com precisão decimal.
- [x] Valor disponível calculado como limite menos utilizado.
- [x] Histórico de utilização de crédito com saldo anterior, saldo posterior, observação, usuário e data.
- [x] Movimentação que ultrapassa o limite é bloqueada.
- [x] Limite não pode ser reduzido abaixo do crédito já utilizado.
- [x] Vale por cliente com saldo atual.
- [x] Histórico de movimentações de vale com saldo anterior, saldo posterior, observação, usuário e data.
- [x] Lançamentos de vale permitidos para perfis com escrita de clientes, incluindo vendedoras.
- [x] Saldo de vale negativo é bloqueado.
- [x] CRM com histórico de relacionamento, registro de atividade, conteúdo, data da ocorrência e acompanhamento futuro.
- [x] Atividade de CRM pode receber data de follow-up e data de conclusão.
- [x] Configuração de `X dias` de inatividade por empresa criada.
- [x] Todas as estruturas são isoladas por empresa e auditadas.
- [x] Regras financeiras críticas também protegidas por constraints no PostgreSQL.
- [x] Migration, Prisma schema, typecheck e build validados.
- [x] Smoke test HTTP real validou segmento, crédito, vale, CRM e configuração de inatividade.
- [ ] Alerta automático de inatividade ligado ao histórico real de compras.
- [ ] Interface final de Crédito/Vale/CRM conforme Stitch.

### Dependência controlada do alerta de inatividade

O documento exige alerta automático após X dias sem compra. O valor X já está configurável. A geração do alerta não será simulada com datas artificiais: ela será conectada ao histórico real de pedidos/compras quando o Progresso 7 implementar o fluxo comercial. Assim a informação de inatividade terá uma única fonte real e não haverá duplicação silenciosa de histórico.

### Evidência atual

O run 51 (`35028235609`) concluiu em sucesso com migrations, seed, isolamento multiempresa, typecheck, build e smoke tests HTTP de autenticação, clientes, segmentação, crédito, vale, CRM e configuração de inatividade.

### Critério de fechamento do Progresso 4

Só vira ✅ quando as interfaces correspondentes estiverem fiéis ao Stitch e o alerta de inatividade estiver consumindo o histórico real de compras do fluxo comercial.
