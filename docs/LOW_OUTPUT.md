# Produtos com baixa saída — critério explícito

## Fonte

O documento-fonte oficial, Etapa 3 — Estoque e Produtos, exige identificar produtos com baixa saída e gerar alertas/indicadores.

O escopo não define qual janela, métrica ou limiar caracteriza baixa saída.

## Implementação desta etapa

O endpoint autenticado:

`GET /api/reports/products/low-output`

exige que o critério seja informado explicitamente:

- `start`;
- `end`;
- `metric=REVENUE`, `SOLD_QUANTITY` ou `PAID_SALES`;
- `threshold` não negativo.

A leitura considera exclusivamente vendas `PAID` dentro do período.

Um produto é marcado como `lowOutput = true` somente quando o valor da métrica escolhida é menor ou igual ao limiar informado na própria requisição.

## Limite deliberado

O ERP não define automaticamente:

- período padrão;
- métrica padrão;
- limiar padrão;
- frequência do alerta;
- tratamento especial para produto novo ou sem histórico;
- consequência comercial.

O retorno registra `source = EXPLICIT_REQUEST` para deixar claro que a classificação depende do critério fornecido, e não de uma regra presumida pelo sistema.

## Validação

O smoke test cobre:

1. classificação por faturamento;
2. classificação por quantidade vendida;
3. classificação por número de vendas pagas;
4. exclusão de vendas fora do período;
5. rejeição de limiar negativo;
6. isolamento multiempresa.
