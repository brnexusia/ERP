# Romaneio de separação — Módulo 2

## Entrega

Rota autenticada: `GET /api/sales/:id/packing-slip`. Disponível na tela de **Vendas & Pedidos** somente após a confirmação de um orçamento.

- PDF real A4 paginado, gerado no servidor sem dependências externas.
- Empresa, identificador do pedido, datas, cliente, endereço, vendedora.
- Quantidade, descrição e SKU congelados nos itens da venda.
- Estado da separação/conferência, com nomes dos responsáveis se já registrados.
- Sem preços, custo, limite de crédito, comissão, informações de cheque ou dados bancários.
- Download com `Content-Disposition: attachment`, sem cache compartilhado.
- Identificação da página e aviso de documento não fiscal.
- Isolamento por `organizationId` e validação de permissão `sales:read`.

## Limites da entrega

O romaneio descreve os itens do pedido; não cria separação ou conferência automaticamente, não faz reserva/baixa de estoque, não emite documento fiscal nem etiqueta de código de barras. As operações de separação/conferência continuam sujeitas às regras de aprovação por um segundo funcionário.

## Verificação

O smoke de suporte/logística valida emissão real, cabeçalho PDF, paginação de pedidos com 80 itens, ausência de dados financeiros, vedação para orçamentos, 401 anônimo, 404 entre empresas e regressão do fluxo de entrega.

Esta atualização não altera o banco nem a VPS.
