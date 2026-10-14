# Módulo 2 — separação e conferência de pedidos

## Entregue

A tela Vendas & Pedidos passa a permitir o registro da separação física de **todos os itens** do pedido e a conferência por **outro funcionário**. As quantidades digitadas devem corresponder ao pedido, sem omissões ou duplicatas. As ações registram responsáveis, datas, itens conferidos e trilha de auditoria.

Para pedidos **criados após a migração**, o ERP impede o primeiro registro de retirada, Correios ou transportadora antes do status **VERIFIED**. A condição é aplicada no servidor, não apenas na tela.

A migração aditiva marca **pedidos já existentes** como legados (sem bloqueio novo), inclusive pedidos com expedição previamente registrada; suas entregas permanecem consultáveis/editáveis. O fluxo pode ser utilizado voluntariamente em pedidos legados sem entrega ainda registrada.

## Não entregue

- Não movimenta, reserva, desconta ou estorna estoque físico; a política de baixa ficará no Módulo 3.
- Não resolve divergência de itens por substituição automática: se quantidade não conferir, o pedido não pode ser liberado; gestão deverá corrigir conforme processo posteriormente aprovado.
- Não automatiza transporte, etiqueta fiscal, emissão de NF-e ou WhatsApp.
- Não substitui o romaneio PDF nem a política de aprovação de descontos; são itens seguintes do Módulo 2.

## Segurança e validação

- Validação de multiempresa por API, relacionamento no banco e triggers de tenant.
- Serialização e auditoria para impedir separações/conferências repetidas.
- A pessoa que separou não pode registrar a própria conferência, inclusive se tiver papel administrativo.
- Gate aplicado na criação de entrega; edições de entregas já existentes não são interrompidas.
- Smoke test: pedido não pode expedir sem verificação; quantidade divergente, separação repetida, verificação pelo separador e dupla verificação são rejeitadas; verificador independente aprova e entrega existente continua utilizável.

## Publicação

A implementação é validada em branch/CI. O deploy na VPS não é automático. Fazer backup do PostgreSQL e validar o processo operacional com dois usuários distintos antes de usar em produção.
