# Indicador de recompra — limites de meses-calendário

## Contexto

O ERP apresenta um sinal factual de recompra em até três meses, baseado apenas nas datas das vendas pagas. A decisão sobre transformar esse sinal em condição comercial de auto-atacado, duração e preços permanece pendente em `docs/DECISIONS_REQUIRED.md`.

## Problema corrigido

O cálculo anterior usava `Date.setUTCMonth(originalMonth + 3)` sem tratar dias ausentes no mês de destino. No JavaScript, 31/08 + três meses deslizava para **01/12**, embora o terceiro mês-calendário termine em 30/11. Consequentemente, uma recompra de 01/12 podia ser incorretamente classificada como dentro dos três meses.

## Regra de cálculo factual

O algoritmo preserva hora/minuto/segundo/milissegundo UTC e avança três meses, limitando o dia ao último dia válido no mês de destino:

- Compra 31/08/2025 12h UTC → limite 30/11/2025 12h UTC.
- Compra 30/11/2024 07h UTC → limite 28/02/2025 07h UTC.
- Compra 30/11/2023 07h UTC → limite 29/02/2024 07h UTC (bissexto).
- Compra 31/01/2024 23:59:59.999 UTC → limite 30/04/2024 no mesmo horário.

A recompra **exatamente no limite** qualifica; depois do limite não qualifica. O sinal permanece só informativo e não altera preço, desconto, estoque, segmentação ou condição de atacado.

## Evidências automatizadas

- `pnpm test:repurchase-month-boundaries`: datas fixas com 28/29/30/31 dias, bissexto e igualdade ao limite.
- `pnpm test:smoke-repurchase-signal` (na cadeia integrada): cria compras pagas e consulta `getClientCommercialProfile`, verificando recompra no dia-limite e fora da janela.

## Bloqueios de aceite de negócio

A política de auto-atacado, a possível exigência de mais de uma recompra, efeitos sobre preços e validade comercial não estão documentados no escopo e continuam sem implementação definitiva.
