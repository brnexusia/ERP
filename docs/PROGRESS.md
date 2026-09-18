# Progresso — ERP Pedro

Estados: ⬜ Não iniciado · 🟡 Em construção · 🟠 Funcional · 🔵 Em homologação · ✅ Fechado.

**Regra:** 🟠 indica base funcional operando com testes, ainda podendo depender de Stitch ou complementos externos. ✅ exige funcionalidade, dados, segurança, testes e visual aplicável efetivamente fechados.

## Marcos

| # | Progresso | Estado |
|---|---|---|
| 1 | Fundação do sistema | ✅ Fechado |
| 2 | Design system + estrutura visual | 🟡 Em construção |
| 3 | Gestão de Clientes | 🟠 Funcional |
| 4 | Crédito, Vale e CRM | 🟠 Funcional |
| 5 | Produtos e estrutura de estoque | 🟠 Funcional |
| 6 | Estoque inteligente | 🟡 Em construção |
| 7 | Fluxo comercial | 🟠 Funcional |
| 8 | Pagamentos e entrega | 🟠 Funcional |
| 9 | Vendedoras, metas e comissões | 🟡 Em construção |
| 10 | Relatórios e dashboards | 🟡 Em construção |
| 11 | Financeiro | 🟠 Funcional |
| 12 | Promoções e catálogo | 🟡 Em construção |
| 13 | Integrações | 🟡 Em construção |
| 14 | Preparação como produto | 🟡 Em construção |
| 15 | Homologação final | ⬜ Não iniciado |

## 1 — Fundação ✅

Next.js/TypeScript/PostgreSQL/Prisma, migrations, autenticação e sessão persistida, troca autenticada de senha com verificação da senha atual e revogação das sessões paralelas, `Organization`/`User`/`Membership`, RBAC, auditoria, healthchecks, backup/restore e CI estão operacionais. O isolamento multiempresa existe na aplicação e possui defesa em profundidade no PostgreSQL: relações operacionais críticas, sessões e conciliação financeira não podem misturar tenants mesmo em escrita direta no banco.

O fechamento da fundação não implica fechamento visual; a interface final continua subordinada ao Stitch.

## 2 — Design system + estrutura visual 🟡

O Stitch aprovado é a fonte visual obrigatória para shell/sidebar, cabeçalhos, cards, dashboards, tabelas, gráficos, filtros, formulários, botões, ícones, modais, estados, tipografia, cores, espaçamentos e responsividade. Dashboard Geral, Clientes & CRM, Produtos & Estoque e o design system são explicitamente citados como telas já desenhadas.

**Bloqueio:** a referência disponível no PDF não possui detalhe suficiente para declarar fidelidade tela/estado/responsividade. Nenhum visual provisório será marcado como final.

## 3 — Gestão de Clientes 🟠

Cadastro/consulta/edição tenant-scoped, nome/razão, CPF/CNPJ, endereço, WhatsApp, e-mail, segmento, vendedora responsável, histórico real de compras pagas, perfil comercial e perfil central estão funcionais. O perfil central também reúne crédito, vale, CRM, suporte e histórico explícito de pagamentos, incluindo registros pagos/pendentes, valor, vencimento/liquidação e venda/vendedora de origem. Auditoria, permissões e bloqueio cross-tenant também estão validados.

**Pendente para ✅:** interface final conforme Stitch.

## 4 — Crédito, Vale e CRM 🟠

Linha de crédito com limite/utilizado/disponível/movimentos, vale com saldo/movimentos, CRM com histórico/follow-up/conclusão, segmentos e `X dias` de inatividade configurável estão funcionais. Constraints críticas, auditoria e isolamento multiempresa estão ativos.

**Pendente para ✅:** interface final conforme Stitch.

## 5 — Produtos e estrutura de estoque 🟠

Produto possui nome, SKU, código de barras, categoria/subcategoria, marca/fabricante, descrição, atributos, fotos/variação, custo, preço, unidade, estoque atual/mínimo/máximo, APIs tenant-scoped, auditoria e armazenamento real de imagens. O catálogo automático lê a mesma base de produtos.

**Pendente para ✅:** Produtos & Estoque conforme Stitch.

## 6 — Estoque inteligente 🟡

Já existem alerta de estoque baixo, mínimo/máximo, quantidade vendida, faturamento, vendas pagas, última venda, estoque e categorias predominantes por cliente.

**Aguardando regra objetiva:** baixa saída, Curva ABC e momento da baixa/reserva física. Nenhum critério será presumido.

## 7 — Fluxo comercial 🟠

`Cliente → Orçamento → Pedido → Pagamento` funciona no mesmo `sale.id`, preservando cliente, vendedora, canal, itens, preço congelado, pagamentos e histórico. A timeline agrega transições, pagamentos, suporte e entrega. Canais: WhatsApp, Site e Loja Física.

**Pendente para ✅:** interface fiel ao Stitch e decisão de baixa física do estoque.

## 8 — Pagamentos e entrega 🟠

Cartão, Pix, boleto e cheque; pagamento pendente/quitado; boleto/cheque com vencimento opcional; pagamentos parciais; atendimento/pós-venda/reclamações/SAC; retirada; Correios; transportadora e comprovantes privados estão funcionais e isolados por empresa. O histórico explícito por cliente registra também as formas utilizadas e seus estados.

**Pendente para ✅:** envio real de rastreio por e-mail/WhatsApp, provedores/templates/gatilhos e interface final.

## 9 — Vendedoras, metas e comissões 🟡

Já implementado: carteira da vendedora, venda vinculada à responsável, vendas pagas, faturamento, clientes únicos, ticket médio, canais e filtro por período.

Metas são funcionais sem presumir periodicidade: cada meta escolhe uma métrica prevista no escopo (`REVENUE`, `SALES` ou `CLIENTS`) e informa `startAt`/`endAt`. O realizado usa somente vendas `PAID`; o ERP calcula realizado, percentual, atingimento e estado `UPCOMING`/`ACTIVE`/`ENDED`. Criação/edição/exclusão são auditadas e o PostgreSQL impede vínculo com vendedora de outro tenant. O perfil da vendedora expõe metas reais.

**Ainda pendente:** fórmula/base/momento das comissões, tratamento de estornos/devoluções, eventual fluxo específico de treinamento/desenvolvimento além dos indicadores já disponíveis e interface final. Comissões continuam explicitamente sem cálculo automático enquanto não houver regra aprovada.

## 10 — Relatórios e dashboards 🟡

Já existem vendas/faturamento por período, ticket médio geral/novos/antigos, canais, performance por vendedora, ranking de compradores, classificação sem compra/novo/recorrente, inatividade por `X dias`, formas de pagamento, categorias predominantes e métricas de produto.

O Dashboard Geral agrega comercial, clientes, inatividade, estoque baixo e financeiro e inclui metas por vendedora com identidade, alvo, realizado, percentual, atingimento e estado temporal. O filtro do dashboard seleciona metas por sobreposição de período sem alterar o período próprio de cálculo da meta. O dashboard é permission-aware e tenant-scoped.

**Pendente:** visual conforme Stitch, comissões após definição de regra e “reduziu compras” após definição de período/métrica/limiar.

## 11 — Financeiro 🟠

Contas a receber derivadas de pagamentos reais, contas a pagar, fluxo de caixa realizado, conciliação bancária manual e relatório consolidado estão funcionais. Conciliações também possuem guard cross-tenant no PostgreSQL.

**Pendente para ✅:** interface final. Automação/importação bancária depende de provedor/contrato técnico.

## 12 — Promoções e catálogo 🟡

Catálogo automático compartilhável por link, imagens públicas de produto, custo oculto e histórico de formas de pagamento já existem.

A base da regra de auto-atacado avançou sem inventar efeito comercial: o perfil comercial detecta factual e exclusivamente sobre vendas `PAID` se houve recompra em até três meses-calendário, preservando os intervalos entre compras. O ERP não aplica automaticamente preço, desconto ou mudança de segmento enquanto esse efeito não estiver definido.

**Aguardando regra:** descontos progressivos, dúzia fechada, promoções, prioridade/empilhamento/vigência/arredondamento e efeito comercial final do auto-atacado. Falta também página visual pública segundo o design system aprovado.

## 13 — Integrações 🟡

A camada tenant-scoped de configuração está preparada para VaxChat, VaxLab, GoPage, ShopVax, WhatsApp, gateway e e-commerce, com estado, referência de segredo, auditoria e isolamento.

Chamadas reais/webhooks/sincronizações dependem de documentação/API, URLs, autenticação, credenciais e contrato de eventos. Configuração cadastrada não significa integração conectada.

## 14 — Preparação como produto 🟡

Multiempresa, gestão de usuários, proteção do último `OWNER`, provisionamento de nova empresa + primeiro `OWNER`, Docker/Compose, PostgreSQL e arquivos persistentes, tokens HMAC, validação de arquivos, auditoria, backup/restore com SHA-256 e round-trip real de recuperação estão operacionais. O CI valida migrations, isolamento, typecheck, build, Compose, recuperação e smoke tests. A concorrência do CI é separada por workflow/ref para PRs e `main` não se cancelarem indevidamente.

**Pendente:** VPS real, domínio/DNS/TLS, e-mail empresarial, política final offsite/retention, planos/cobrança/assinatura e provisionamento acionado por contratação.

## 15 — Homologação final ⬜

Só começa quando as dependências necessárias estiverem resolvidas. Deve cobrir E2E, permissões, isolamento, consistência, arquivos/recuperação, erros/duplicidades, segurança, performance, responsividade, comparação tela a tela com Stitch e integrações externas reais.

## Evidências recentes

- Run 237 (`35048022891`): proteção cross-site e pagamentos + suíte verde.
- Run 258 (`35049646523`): restore real PostgreSQL/arquivos + suíte verde.
- Run 267 (`35050244542`): fonte oficial revalidada e formas de pagamento preservadas.
- Run 269 (`35051330767`): guards de consistência multiempresa no PostgreSQL.
- Run 271 (`35051855628`): guards de tenant na conciliação financeira.
- Run 273 (`35059990237`): definição/acompanhamento de metas por vendedora + suíte completa verde.
- Run 276 (`35060420308`): metas integradas ao Dashboard Geral + concorrência de CI corrigida + suíte completa verde.
- Run 277 (`35060600021`): mesma cabeça funcional incorporada ao `main`, com migrations, isolamento, typecheck, build, recuperação e smoke tests verdes.
- Run 279 (`35061202048`): histórico explícito de formas de pagamento por cliente, perfil central e isolamento + suíte completa verde.
- PR #9: troca autenticada de senha incorporada ao `main`, com senha atual obrigatória, bloqueio de reutilização, revogação das demais sessões e auditoria sem exposição de credenciais.

A matriz requisito oficial → implementação → progresso está em `docs/SCOPE_TRACEABILITY.md`.

## Regras ainda pendentes

Permanecem sem implementação automática final até aprovação objetiva: “reduziu compras”, baixa saída, Curva ABC, comissões, efeito comercial do auto-atacado, baixa/reserva de estoque, promoções/descontos progressivos e integrações externas cujo contrato técnico ainda não foi fornecido.

Metas não estão mais nessa lista: a empresa escolhe por meta uma métrica suportada pela fonte e informa explicitamente o período, sem recorrência presumida. A janela factual de recompra do auto-atacado também já é detectada; somente seu efeito comercial permanece pendente.
