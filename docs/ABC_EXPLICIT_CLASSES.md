# Curva ABC com faixas explícitas por consulta

**Fonte:** ERP Pedro — Etapa 3, inteligência de estoque, classificação ABC por produtos.

## Situação anterior

O sistema já apurava, para o período/métrica explicitados, vendas realmente pagas, faturamento ou quantidade vendida, participação e participação acumulada de cada produto. Como o escopo não estabelece percentuais A/B/C, todas as classes eram retornadas como `PENDING_THRESHOLDS`.

## Avanço implementado

A API `GET /api/reports/products/abc-distribution` e o painel `/products/intelligence` agora aceitam dois limites **opcionais e explícitos**, em pontos percentuais acumulados:

- `classAUpToPercent`: limite superior A, maior que 0;
- `classBUpToPercent`: limite superior B, superior ao limite A e inferior a 100;
- ambos ausentes: mantém participação factual, sem atribuir classe alguma;
- ambos presentes: classifica cada produto com participação acumulada até A como A, até B como B, acima de B como C; itens com zero contribuição na métrica/período ficam `UNCLASSIFIED`.

O cálculo da classificação usa percentual decimal completo, antes de arredondar os quatro decimais mostrados no relatório, evitando alterações inesperadas na fronteira. O período, a métrica e os limites pertencem somente à consulta feita pelo usuário. **Nenhum default, regra persistida por empresa, ação de estoque, reprecificação ou alteração comercial é realizado.**

Requisição com limite isolado, limites invertidos, zero, 100, texto inválido ou período inconsistente retorna erro 400. O response informa `classificationStatus=EXPLICIT_THRESHOLDS`, `classificationSource=EXPLICIT_REQUEST` e os limites. Sem faixas, mantém `PENDING_THRESHOLDS`.

## Rastreabilidade e limites

- A análise ABC **sob critérios escolhidos pelo usuário** está funcional; definição e aprovação dos percentuais oficiais por empresa, periodicidade automática e efeitos comerciais continuam bloqueados em `docs/DECISIONS_REQUIRED.md`.
- O `smoke-abc-distribution` valida faixa A/B/C explícita, mudança de fronteira, rejeições 400, cenário sem faixas, período de vendas pagas e isolamento entre empresas.
- Este relatório não constitui baixa automática, promoção ou previsão de demanda.

## Homologação

Roda dentro do CI via `pnpm test:smoke-client-management`; visual final permanece dependente dos exports do Stitch aprovado.
