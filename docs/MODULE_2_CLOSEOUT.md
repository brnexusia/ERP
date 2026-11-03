# Módulo 2 — Gate de fechamento técnico e aceite de negócio

**Escopo de origem:** ERP Pedro, documento oficial consolidado em 15/09/2026, páginas 6 e 7, `Etapa 2 — Vendas, Relatórios e Comissões`. O módulo inclui 13 frentes, da classificação de clientes até dashboards comerciais. Esta checklist não substitui o Stitch visual aprovado.

## Estado do módulo

A implementação cobre a operação comercial principal, com os mesmos IDs de cliente/venda durante orçamento → pedido → pagamento e entrega. O teste técnico **não substitui** aceite financeiro/operacional nem valida provedores em produção. É possível atingir **pronto para homologação de negócio** sem falsamente declarar a etapa **100% entregue**.

| # | Requisito do PDF oficial | Evidência implementada | Limitação ou gate |
|---|---|---|---|
| 1 | Maiores compradores, reduziu/parou, novos/recorrentes | Ranking, classificação factual por vendas pagas, comparação de dois períodos explícitos, X dias de inatividade | Períodos e limiar **automáticos** de redução dependem de definição |
| 2 | Direcionar cliente à vendedora | Associação de vendedora responsável com tenant-scoping | Verificar carteira e permissões na operação real |
| 3 | Perfil do cliente para vendedoras | Perfil central/comercial, compras, CRM, atendimentos e financeiro | Validar apresentação e visibilidade com perfis reais |
| 4 | Orçamento → pedido → pagamento | `Sale.id` único, transições, guardas de alterações e histórico | Aceite do processo e das exceções |
| 5 | Cartão, Pix, boleto e cheque à vista/pré-datado | Métodos, vencimentos, pagamentos parciais, quitação e cheque devolvido | Provedor bancário real não consta do escopo técnico fechado |
| 6 | Registro completo por venda | Cliente, item, quantidade, método, responsável, datas e valores | Conferência com dados autorizados |
| 7 | Desempenho e comissões | Perfis de vendedoras, relatórios; prévia, percentuais por vendedora/representante, fechamento auditado, conta a pagar e correções | **Aceite comercial da base, competência, percentuais, estornos e exceções**; não presumir aprovação tácita |
| 8 | Ticket médio geral, novos e antigos, filtros | Serviço de relatórios comerciais com período explícito | Conferência dos conceitos e classificação pelo negócio |
| 9 | Canais WhatsApp, site, loja física | `SaleChannel` e indicadores reais | Venda vinculada ao canal correto |
| 10 | Metas por vendedora e indicadores | Metas auditadas por vendedora, período e métrica explícitos | Política de metas recorrentes não foi definida |
| 11 | SAC/pós-venda/reclamações | `/support`, registros por cliente e pedido, filtros, paginação, auditoria | Aceite operacional |
| 12 | Retirada, Correios, transportadora e comprovantes | Conferência por pessoa diferente, retirada/rastreio/transportadora, arquivos privados e romaneio PDF | **Envio efetivo de rastreio por e-mail/WhatsApp** depende de provedores/credenciais/templates |
| 13 | Dashboards de vendas, faturamento, clientes, metas e vendedores | `/`, `/reports`, `/commissions`, período, canais e metas | **Confronto visual com Stitch**, telas e estados completos |

## Gate automatizado e reproduzível

### Banco isolado de homologação

A CI configura PostgreSQL, migrations e seed; valida tipos, RBAC/tenant, build, Compose, backup/restauração de banco e arquivos e inicia a aplicação local temporária.

**Gate de negócio executável:**
```bash
pnpm test:module-2
```

Roda os cenários existentes de vendas, timeline, relatórios, ranking/classificação, redução de compras, perfil de vendedor, metas, comissões/fechamentos/ajustes, cheque devolvido, SAC, separação/conferência, entrega e provas, metas no dashboard, perfil/pagamentos do cliente e proteção das taxas/lançamentos financeiros. Não envia mensagens nem transfere dinheiro.

**Gate em navegador:**
```bash
pnpm test:browser
```

O teste `tests/e2e/module2-workspaces.spec.ts` visita vendas, relatórios, comissões e SAC em Chromium **desktop (1440×900) e mobile (390×844)**. Exercita a abertura do formulário de orçamento e atendimento, filtro de período de relatórios, visualização de comissões e responsividade sem overflow global, captura screenshots e falha em exceções JavaScript. O teste **não** aprova comissões ou altera dados reais.

Ambos pressupõem a aplicação rodando com o tenant e credenciais de seed em **ambiente descartável de CI/homologação**, não na VPS de produção. A CI integrada já executa o conjunto de smokes; o comando dedicado permite repetir só o pacote da Etapa 2.

## Gate externo de aceite — NÃO resolvido por CI

- [ ] Responsável comercial aprova por escrito as **regras efetivamente utilizadas** em comissões: percentuais, base líquida, reconhecimento por pedido/parcela, competência, vencimento, tratamento de cheque devolvido, ajustes e quitações
- [ ] Fornecer os arquivos/exports do **Stitch aprovado** e comparar páginas, modais, filtros, desktop e mobile; registrar diferenças e aprovação
- [ ] Fornecer provedores/credenciais de **e-mail e WhatsApp** e templates aprovados, homologar disparo real de código de rastreio e casos de reenvio
- [ ] Validar fluxo real com gestor, vendedora, responsável por conferência e financeiro usando dados autorizados, inclusive estorno/devolução e exceções
- [ ] Confirmar ambiente de homologação/produção, domínio, backups externos e rollback antes de publicação

**Regra de status:** CI verde = **homologação técnica automatizada**. O Módulo 2 só pode ser marcado ✅/100% após os cinco itens externos aplicáveis e aceite registrado. A equipe não deve usar a falta de contrato técnico como justificativa para simular mensagens enviadas.

## Regra de integração

Esta branch técnica está baseada na branch cumulativa do PR #58. Se houver merge no `main`, integrar **uma única branch consolidada** e evitar duplicar PRs sobrepostos. Nenhum merge ou deploy é uma consequência automática de testes verdes.
