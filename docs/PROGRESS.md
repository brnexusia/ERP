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
| 1 | Fundação do sistema | 🟡 Em construção |
| 2 | Design system + estrutura visual | ⬜ Não iniciado |
| 3 | Gestão de Clientes | ⬜ Não iniciado |
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

## Checklist do Progresso 1

- [x] Repositório oficial identificado e inicializado.
- [x] Arquitetura-base documentada.
- [x] Estratégia multiempresa definida.
- [x] Regra de isolamento de dados definida.
- [x] Aplicação Next.js/TypeScript criada.
- [x] PostgreSQL local reproduzível configurado.
- [x] Prisma configurado.
- [x] Modelos base de empresa, usuário, membership, sessão, integração e auditoria.
- [x] Autenticação base implementada (senha + sessão persistida + logout).
- [x] Controle de tenant e troca segura de empresa implementados.
- [x] Rota raiz protegida e tela provisória de login criada.
- [ ] Instalação/build executados em ambiente do projeto.
- [ ] Primeira migration aplicada no PostgreSQL real.
- [ ] Seed do primeiro tenant/administrador executado.
- [ ] Teste real de isolamento entre duas empresas.
- [ ] Estrutura de produção/backups definida.

## Critério de fechamento do Progresso 1

O marco só vira ✅ quando for possível autenticar, selecionar/operar dentro de uma empresa, navegar na estrutura-base e provar por teste que um usuário de uma empresa não acessa dados de outra.
