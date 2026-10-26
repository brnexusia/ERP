# Perfil central — categorias compradas e histórico de pagamentos

**Escopo oficial:** Etapa 3, itens 6 (análise por categoria no histórico de compras de cada cliente) e 9 (histórico das formas de pagamento).

## Integração de dados existente reutilizada

- `getClientCommercialProfile` já calcula `predominantCategories` para compras **PAID**, por `categoryId`, nome, quantidade e valor factual dos itens; esta implementação apenas torna os dados visíveis no perfil central.
- `getClientPaymentHistory` já fornece lançamentos reais de `SalePayment`, com forma, valor, situação, data, vencimento, liquidação, vendedor e agrupamentos por método.
- O frontend `/clients` agora exibe uma tabela de categorias ordenada pelo valor dos itens, participação proporcional **dentro dos itens**, resumo por forma de pagamento e tabela de todos os lançamentos históricos.
- A participação é `valor de itens da categoria / soma dos valores de itens de todas as categorias`; **não** é uma regra ABC, comissão ou indicador de faturamento líquido após descontos. Não adota limiares nem faixas comerciais.
- Dados são obtidos pela rota autenticada e isolada por empresa `GET /api/clients/[id]/central-profile`. Não há endpoints públicos de informações financeiras.

## Testes

O smoke integrado `smoke-central-client-profile.ts`, já invocado pela CI, valida que uma venda paga de R$30 com um produto produz exatamente uma categoria de quantidade 1 e valor 30, que a transação Pix paga aparece nos métodos e no histórico, e que a mudança de empresa bloqueia a consulta do cliente anterior. O teste também passou a apagar apenas a própria sessão temporária de administração.

## Limite de aceite

A tabela usa o padrão visual já presente no ERP, mas continua sujeita à comparação formal com as fontes completas do Stitch aprovado.
