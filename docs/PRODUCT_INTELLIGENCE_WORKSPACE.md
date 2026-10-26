# Indicadores de produtos — interface de consulta

A rota `/products/intelligence` expõe relatórios reais já disponibilizados pelas APIs existentes:

- Vendas por produto: unidades vendidas, faturamento, quantidade de vendas pagas e data da última venda.
- Participação por produto (base de Curva ABC): ranking, participação percentual e participação acumulada. **Nenhuma classe A/B/C é inferida** porque as faixas não foram aprovadas.
- Baixa saída: filtro matemático pelo valor máximo definido **pelo próprio usuário**, com período e métrica selecionados. Não há alertas ou padrões automáticos inventados.

O período completo é obrigatório na interface; sem consulta não há relatório predefinido. Os cálculos consideram somente vendas pagas e permanecem tenant-scoped, com permissões `inventory:read` e `sales:read` verificadas tanto na interface quanto nos serviços.

## Validação

`pnpm test:smoke-product-intelligence-page`, build/typecheck e as suítes já existentes `smoke-abc-distribution` e `smoke-low-output`. O smoke verifica ausência de sessão, resposta HTML autenticada, endpoints e ausência explícita de faixas ABC automáticas.

A homologação do layout requer o Stitch completo aprovado; o ERP não oferece classificação comercial final sem regra objetiva.
