# Distribuição factual para Curva ABC

## Fonte

O documento-fonte oficial, Etapa 3 — Estoque e Produtos, exige Curva ABC com classificação dos produtos por importância, faturamento e giro.

O escopo não define as faixas A/B/C, pesos, período padrão nem frequência de recálculo.

## Implementação desta etapa

O endpoint autenticado:

`GET /api/reports/products/abc-distribution`

exige parâmetros explícitos:

- `start`;
- `end`;
- `metric=REVENUE` ou `metric=SOLD_QUANTITY`.

A leitura considera exclusivamente vendas `PAID` dentro do período informado.

Para cada produto, o relatório retorna:

- ranking;
- quantidade vendida;
- faturamento;
- quantidade de vendas pagas;
- última venda no período;
- estoque atual;
- valor da métrica escolhida;
- participação percentual na métrica;
- participação percentual acumulada.

## Limite deliberado

A distribuição não atribui automaticamente classes A, B ou C.

Enquanto as faixas não forem aprovadas, cada item retorna:

- `abcClass = PENDING_THRESHOLDS`;
- relatório com `classificationStatus = PENDING_THRESHOLDS`.

Isso permite construir a base quantitativa da Curva ABC sem adotar silenciosamente um padrão de mercado ou inventar uma regra comercial.

## Validação

O smoke test cobre:

1. ranking por receita;
2. ranking por quantidade vendida;
3. exclusão de vendas fora do período;
4. participação e acumulado;
5. rejeição de parâmetros incompletos;
6. isolamento multiempresa.
