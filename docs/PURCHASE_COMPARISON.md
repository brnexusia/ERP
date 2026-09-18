# Comparação factual de redução de compras

## Fonte

O documento-fonte oficial, Etapa 2 — Vendas, Relatórios e Comissões, exige classificar clientes que reduziram compras.

O escopo não define, porém, qual período deve ser comparado, qual métrica representa “compras” nem qual limiar configuraria redução.

## Implementação desta etapa

O endpoint autenticado:

`GET /api/reports/clients/purchase-comparison`

permite comparar dois períodos informados explicitamente pelo usuário:

- `previousStart` / `previousEnd`;
- `currentStart` / `currentEnd`;
- `metric=REVENUE` para valor comprado;
- `metric=PURCHASES` para quantidade de compras.

A leitura considera exclusivamente vendas com estágio `PAID` e permanece isolada pela empresa ativa.

Para cada cliente, o relatório retorna:

- compras e faturamento no período anterior;
- compras e faturamento no período atual;
- diferenças absolutas;
- variação percentual quando o período anterior não é zero;
- direção factual `REDUCED`, `INCREASED` ou `UNCHANGED`;
- indicador booleano `reduced` referente somente à métrica escolhida.

## Limite deliberado

O ERP não escolhe automaticamente:

- período anterior;
- período atual;
- métrica;
- limiar mínimo de queda;
- frequência de comparação;
- ação comercial decorrente da redução.

Assim, a informação exigida pelo escopo fica disponível sem transformar uma lacuna de regra de negócio em comportamento presumido.

Uma eventual classificação automática padrão continua dependente de decisão objetiva de negócio.

## Validação

O smoke test cobre:

1. cliente com redução de receita e quantidade de compras;
2. cliente com aumento;
3. cliente sem alteração;
4. comparação por `REVENUE` e `PURCHASES`;
5. rejeição de parâmetros incompletos;
6. isolamento entre empresas.
