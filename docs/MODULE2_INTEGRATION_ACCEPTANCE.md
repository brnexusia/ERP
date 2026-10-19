# Módulo 2 — Homologação integrada (etapa 2)

## Critério de aceitação automatizado

O smoke existente `scripts/smoke-support-delivery.ts` foi ampliado para executar **em uma única venda e um único cliente**:

1. Cliente e vendedora vinculados; produto cadastrado a preço de tabela de R$ 25,00.
2. Orçamento criado; desconto de 10% solicitado e pedido bloqueado até aprovação.
3. Aprovação por gestor: total líquido de R$ 22,50; valor bruto do item preservado em R$ 25,00.
4. Confirmação como pedido, sem novo registro de venda nem edição silenciosa dos itens.
5. Primeira tentativa de expedição bloqueada; separação física por um usuário e conferência por outro; entrega liberada somente após isso.
6. Romaneio PDF emitido após confirmação, com dados do pedido, sem detalhes financeiros.
7. Liquidação integral do pedido por Pix pelo valor líquido; pagamento excedente rejeitado.
8. Prévia de comissão calculada sobre o **líquido**, com alíquota registrada da vendedora de 5% (R$ 1,13 arredondado); **sem** criação de conta a pagar na etapa de prévia.
9. Histórico de cliente, venda, pagamento e entrega no mesmo identificador; auditoria de desconto, separação e conferência uma vez por evento.
10. Estoque físico permanece sem baixa automática, aguardando as regras definidas para o Módulo 3.

Todos os registros de teste são criados no PostgreSQL **isolado** do CI e removidos ao fim. O teste é executado pelo comando atual `pnpm test:smoke-client-management`, sem nova migração, endpoint ou dependência.

## Limites desta validação

Os testes garantem o **comportamento do backend/API** no ambiente automatizado, não a qualidade de apresentação de todas as telas em um navegador real. Também não equivalem a homologação financeira com dados reais nem publicação no EasyPanel.

### Checklist de homologação visual — Stitch

- [ ] Comparar tela Vendas & Pedidos com a tela oficial do Stitch, lado a lado em viewport desktop.
- [ ] Conferir sidebar, títulos, cabeçalhos, cartões e indicadores; alinhamento, espaçamento e tipografia.
- [ ] Conferir tabela comercial, filtros, ações e formulário de orçamento; estados vazio, erro, loading e sucesso.
- [ ] Conferir painéis de desconto, pagamentos, conferência, romaneio e solicitações de ajustes, com os padrões já aprovados.
- [ ] Conferir comportamento responsivo em dispositivos móveis.
- [ ] Registrar capturas de tela e diferenças para aprovação. **Não afirmar equivalência visual sem comparação objetiva**.

### Checklist de homologação operacional — ERP publicado

- [ ] Criar usuário de vendedora, conferente diferente e gestor; atribuir somente as permissões necessárias.
- [ ] Executar venda simulada e verificar que o financeiro recebeu valor líquido correto.
- [ ] Confirmar que impressão real do PDF está legível em A4.
- [ ] Confirmar política comercial de descontos, encargos e baixa de comissões com responsáveis da operação.
- [ ] Gerar backup PostgreSQL antes de aplicar qualquer atualização/migração na VPS.

Não houve mudança em dados de produção neste lote.
