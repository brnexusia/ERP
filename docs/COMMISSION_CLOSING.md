# Módulo 2 — Fechamento e pagamento de comissões

## Fluxo operacional

O demonstrativo existente de comissões permanece uma **prévia gerencial**, sem qualquer obrigação financeira até a autorização do gestor. Após o fim da competência mensal, OWNER/ADMIN/MANAGER podem aprovar individualmente cada resultado positivo.

1. **Vendedora:** um fechamento por vendedora e mês, calculado a partir das vendas já confirmadas e dos percentuais congelados em cada pedido. A data de vencimento é o dia 15 do mês seguinte, conforme a regra existente.
2. **Representante:** um fechamento independente **por parcela** de cheque, boleto ou vale, calculado sobre o percentual congelado na venda e o valor daquela parcela. O vencimento da conta a pagar é a própria data prevista da parcela, mesmo que a compensação financeira ocorra depois.
3. No fechamento, valores, linhas de origem, data e beneficiário são congelados em snapshot imutável. A mesma transação cria uma **única conta a pagar** vinculada e uma auditoria de aprovação.
4. A conta a pagar começa como **PENDING**. Após pagamento real externo, a equipe com permissão `finance:write` pode marcar como **PAID** usando a rotina financeira existente. Isso afeta o fluxo de caixa somente na data da baixa. O sistema **não executa transferência/Pix automaticamente**.
5. Um segundo fechamento para a mesma vendedora/mês ou mesma parcela de representante é recusado, inclusive sob concorrência. Valores nulos ou zero não criam obrigação.
6. FINANCE pode visualizar todos os fechamentos e registrar pagamento, mas **não aprovar o próprio fechamento**. Vendedoras não podem aprovar, pagar ou consultar o demonstrativo gerencial de outras pessoas.

## Limites importantes

- Somente competências **encerradas** podem ser fechadas. A prévia do mês atual continua consultável.
- Uma comissão já aprovada não é recalculada automaticamente por alterações posteriores no cadastro de comissão ou em dados comerciais. Eventuais ajustes devem ser autorizados por um fluxo separado e auditado.
- O cálculo de representantes segue a **data de vencimento da parcela, não a compensação**. Cheques devolvidos não estornam automaticamente comissão já aprovada/paga.
- O fechamento registra **contas a pagar e quitação manual**, não transferência, NF, imposto ou conciliação bancária automática.
- A competência utiliza o fuso comercial `America/Sao_Paulo` nos cálculos existentes; timezone multiempresa continua pendente.
- Não altera os registros históricos anteriores nem efetua lançamentos na VPS durante testes.

## Verificações automáticas

Smoke valida valores e vencimentos, usuário sem permissão, impossibilidade de fechar competência aberta, duplicidade de fechamento, criação de conta a pagar, separação do status `PENDING` de `PAID`, quitação idempotente, auditoria e isolamento de empresas. CI inclui validação de migração, build, permissões, backup e testes funcionais.

**Antes de publicar:** backup PostgreSQL no EasyPanel, homologação financeira com a gestão e conferência dos parâmetros de comissão reais.
