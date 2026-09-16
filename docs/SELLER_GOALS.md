# Metas por vendedora

Este módulo implementa a exigência do documento-fonte de **definição e acompanhamento de metas por vendedora**, usando apenas indicadores explicitamente previstos no próprio escopo: vendas, faturamento e clientes.

## Regra de modelagem

O documento oficial não determina periodicidade fixa. Por isso o ERP não presume meta mensal, semanal ou diária. Cada meta possui `startAt` e `endAt` explícitos.

Métricas disponíveis:
- `REVENUE`: faturamento efetivamente pago no período;
- `SALES`: quantidade de vendas efetivamente pagas no período;
- `CLIENTS`: quantidade de clientes únicos em vendas efetivamente pagas no período.

Metas de vendas e clientes exigem alvo inteiro. Faturamento aceita até duas casas decimais.

## Acompanhamento

Para cada meta o ERP calcula:
- valor-alvo;
- realizado no período;
- percentual de atingimento;
- atingida ou não atingida;
- estado temporal: futura, ativa ou encerrada.

O percentual pode ultrapassar 100%, preservando o desempenho realizado em vez de truncá-lo.

## Autorização e isolamento

- leitura exige acesso comercial (`sales:read`);
- criação, alteração e exclusão exigem `organization:manage`;
- o vendedor da meta deve ser um `Membership` com papel `SELLER` do mesmo tenant;
- o criador deve possuir vínculo com a mesma organização;
- o PostgreSQL aplica guard adicional contra vínculo cross-tenant.

## Comissões

Comissões continuam fora deste módulo. O documento exige página e acompanhamento de comissões, porém não define fórmula, percentual, base de cálculo, competência ou tratamento de estornos/devoluções. Nenhuma dessas regras é presumida pela implementação de metas.
