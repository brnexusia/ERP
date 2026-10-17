# Módulo 2 — Cobranças avulsas por cliente

## Escopo implementado

Débitos independentes de pedidos e vendas (ex.: ajustes operacionais previamente autorizados) são lançados com: cliente, referência única na empresa, descrição, valor original, vencimento, operador e data. A tela `/receivables` usa o design system atual e é visível a perfis com permissão `finance:read`.

Somente `finance:write` pode criar cobranças e registrar recebimentos. Cada recebimento possui valor, data, meio (Pix, dinheiro, cartão ou transferência), observação opcional, operador, auditoria e token de idempotência. A quitação parcial e total é calculada pela soma do histórico, sem sobrescrever registros. Repetição idêntica da mesma operação não cria nova baixa.

O total pendente é incluído no indicador de contas a receber, acompanhado de valores vencidos. O fluxo de caixa inclui **somente os recebimentos efetivos**, na data informada. O endpoint existente `/api/finance/receivables` preserva `receivables` e `returnedCheques`, incluindo `manualReceivables` em campo separado para não misturar as parcelas de vendas.

A referência única por empresa ajuda a impedir cobranças duplicadas. O ERP **não cria Sale, SaleItem, SalePayment, comissão ou movimentação de estoque** para débitos avulsos. O operador deve usar Vendas & Pedidos para novas compras, não esta tela.

## Proteções

- Validação de empresa e cliente, inclusive no banco com triggers de tenant.
- Saldo calculado com precisão decimal; proibição de recebimento superior ao valor devido.
- Transações serializáveis para concorrência, chave UUID única para idempotência.
- Sem exclusão ou edição silenciosa de lançamentos financeiros; operação de correção/estorno deve ser definida à parte.
- Auditoria de cadastro e de cada recebimento.
- Desconto comercial, limite de crédito e vale não são movimentados por estes registros.

## Fora do escopo desta entrega

Juros automáticos, renegociação, parcelamento contratado (as baixas parciais já são permitidas), notificações WhatsApp, geração de boleto, emissão fiscal e conciliação bancária de recebimentos avulsos. Esses recursos exigem regras e integrações futuras.

Antes de produção, a gestão deve determinar quais naturezas de débito podem ser lançadas, quem autoriza e como identificar a referência documental. A presença da tela não substitui essa validação operacional.

## Homologação

CI em ambiente isolado testa validação, isolamento por empresa, referência duplicada, criação sem entrada de caixa, baixa parcial/total, idempotência, rejeição de excesso, efeito nos indicadores, ausência de venda duplicada e histórico de auditoria. A migração é aditiva. Deploy na VPS **não** é automático; criar backup do PostgreSQL antes de publicar.
