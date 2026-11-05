# Dashboard Geral — período explícito e indicadores atuais

**Referência funcional:** documento oficial do ERP Pedro, Etapa 2, itens 7–8 e 13: desempenho, relatórios com filtros por período, faturamento, vendas, metas e indicadores.

## Funcionamento

- A página `/` agora mostra dois campos de data, `De` e `Até`, com ação `Aplicar`. O usuário escolhe o intervalo: a UI envia datas ISO com offset `-03:00` para `GET /api/dashboard?start=...&end=...`.
- Sem filtro, a UI indica claramente **Todo o histórico**. O rótulo anterior **Período atual** era enganoso porque não existia uma seleção de período.
- O formulário exige ambos os dias e rejeita data final anterior à inicial, sem efetuar uma requisição inválida; o backend permanece responsável pela validação 400.
- Indicadores comerciais (vendas, faturamento, ticket, vendedores e ranking) utilizam `Sale.paidAt` no intervalo; as entradas e saídas de caixa usam **data de liquidação financeira** dos recebimentos ou pagamentos, que pode ser diferente da data comercial da venda. Ambos são corretos dentro de seus critérios; filtros não interferem no cálculo real do estoque.
- **Estoque baixo, inatividade atual e pendências em aberto são fotografias do estado atual, independentes do intervalo financeiro/comercial**. Essa distinção aparece na interface para evitar interpretação equivocada.
- Ações de limpar filtro e atualização não modificam dados.

## Segurança e homologação

Permissões e segregação multiempresa continuam avaliadas no servidor pelo agregador existente. `smoke-dashboard.ts` valida filtro incluindo uma venda paga há dois dias, filtro de realização financeira na data da liquidação (diferente da data da venda), filtro futuro sem vendas, estoque atual preservado e rejeição de intervalo invertido. O teste elimina apenas sua própria sessão administrativa, preservando as demais.

A estrutura segue os tokens e componentes atuais e continua pendente de comparação formal com os arquivos completos do Stitch.
