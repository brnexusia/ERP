# Sinal factual de recompra em até 3 meses

## Fonte

O documento-fonte oficial, Etapa 3 — Estoque e Produtos, item 8, exige uma **regra de auto-atacado baseada em recompra dentro de período de até 3 meses**.

## Implementação desta etapa

O ERP passa a calcular, no perfil comercial do cliente, um sinal factual chamado `repurchaseWithinThreeMonths`.

A leitura usa somente vendas com estágio `PAID` e respectivas datas `paidAt`. As compras são ordenadas cronologicamente e cada recompra é comparada com a compra paga imediatamente anterior.

Uma recompra é marcada como `withinThreeMonths = true` quando ocorreu até três meses-calendário depois da compra anterior. O retorno contém:

- se foi detectada pelo menos uma recompra dentro da janela;
- quantidade de recompras que cumpriram a janela;
- primeira e última recompra qualificante;
- intervalos entre compras pagas, em dias;
- base factual utilizada (`PAID_PURCHASES`);
- janela aplicada (`UP_TO_3_CALENDAR_MONTHS`).

## Limite deliberado

O sistema **não aplica automaticamente preço de atacado, desconto ou mudança de segmento** a partir desse sinal.

O documento determina que a regra seja baseada em recompra em até 3 meses, mas não define o efeito comercial exato, duração da classificação, preço, desconto ou interação com promoções. Por isso o retorno mantém `commercialEffect = PENDING_RULE_DEFINITION`.

Assim, a detecção factual exigida pela fonte fica disponível sem transformar uma lacuna de regra comercial em comportamento inventado.
