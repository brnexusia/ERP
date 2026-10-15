# Etapa 2 — Descontos sujeitos a aprovação

## Regra implementada

Por falta de um limite comercial de autonomia formalmente aprovado, **todo desconto positivo exige aprovação explícita** de OWNER, ADMIN ou MANAGER. O percentual é solicitado sobre o **total bruto do orçamento** (não por produto), entre 0% e 100% sem os extremos, acompanhado de justificativa. A solicitação fica pendente, sem modificar preços ou valores.

- Um orçamento pode ter apenas um desconto pendente ou aprovado; recusas anteriores ficam registradas.
- Uma solicitação pendente bloqueia a confirmação do pedido e a edição do orçamento.
- A gestão pode recusar, liberando novamente o orçamento, ou aprovar.
- Na aprovação, grava `Sale.discountAmount` e reduz `Sale.totalAmount` em uma transação serializável. O total líquido alimenta cobrança, pagamentos e prévia de comissões.
- `SaleItem.unitPrice` e `SaleItem.lineTotal` continuam representando valores brutos de tabela, preservando o detalhamento comercial. Os relatórios por item devem distinguir bruto/líquido; **não considerar totais por item como receita líquida**.
- Após a aprovação o orçamento permanece congelado. Pode ser confirmado como pedido, sem nova edição dos itens.
- Decisão repetida, percentuais inválidos, solicitação duplicada, crédito/desconto após pagamento ou acesso entre empresas são recusados.
- Histórico e nomes de solicitante/aprovador, motivo, taxa e valor da decisão são exibidos em Vendas & Pedidos, com auditoria adicional no servidor.
- Nenhuma política de desconto automático ou limite para vendedoras foi inventada.

## Limites e próximos pontos

- Este lote só autoriza desconto percentual no **total do orçamento**, não desconto específico por item ou múltiplas campanhas.
- Ainda não há cancelamento/reversão de desconto aprovado. O processo deve ser homologado antes de habilitar essa operação.
- Não modifica estoque, cálculo tributário nem emissão de NF-e.
- Percentuais limites por cargo/cliente/produto devem ser definidos pela gestão e cadastrados como configuração da empresa numa etapa posterior.
- Não gera comissão paga automaticamente nem altera dados reais na VPS.

## Gate técnico

CI valida pedidos com desconto pendente, rejeição/liberação de edição, aprovação com valor líquido correto e preço bruto preservado, segunda aprovação recusada, vendedora sem autorização para aprovar, quitação sobre valor líquido, auditoria e isolamento multiempresa. A migração é aditiva e mantém os preços de todas as vendas já registradas.
