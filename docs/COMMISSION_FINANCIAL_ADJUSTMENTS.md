# Módulo 2 — Correções financeiras de comissões

## Problema resolvido

Após o fechamento de comissão, a gestão pode descobrir uma divergência justificada, inclusive um **cheque devolvido**. O fechamento original é evidência comercial e não pode ser reescrito silenciosamente. Por outro lado, a obrigação financeira ainda **pendente** pode precisar de correção antes do pagamento.

## Regras implementadas

- OWNER, ADMIN, MANAGER e FINANCE podem **solicitar** acréscimo ou redução sobre uma conta de comissão aprovada, informando valor positivo e justificativa de 8 a 500 caracteres.
- Apenas OWNER, ADMIN ou MANAGER podem **aprovar ou recusar**. Antes da aprovação, não há modificação de valores ou lançamentos no caixa.
- É permitida somente **uma solicitação pendente por fechamento**. A decisão gera um registro imutável com usuário responsável, data, motivo e, quando aprovada, os valores **antes/depois**.
- Na aprovação, só se modifica `AccountPayable.amount`, e **apenas enquanto a conta estiver PENDING e sem conciliação bancária**. `CommissionClosing.amount`, `snapshot` e o percentual histórico permanecem intactos.
- Reduções não podem zerar a conta. Correções parciais ou integrais de valor já pago necessitam processo independente de ressarcimento ou crédito, ainda **não habilitado**.
- A baixa de conta a pagar fica bloqueada enquanto existir correção aguardando decisão. Depois de decidida, a quitação exige registro manual do financeiro, sem transação bancária automática.
- Cheque devolvido **não gera estorno automático da comissão**. A gestão deve avaliar o contrato e a política aplicável, solicitar e aprovar uma correção quando cabível.
- Todos os serviços e tabelas mantêm isolamento `organizationId` e trilha `AuditLog`. O banco impede dois pedidos pendentes pelo mesmo fechamento e exige consistência entre estado/decisão e valores.

## Limites

A entrega corrige **somente comissões ainda não pagas nem conciliadas**. Não altera contas a receber do cliente, valor da venda, pagamentos, saldo de vale, comissão já quitada, estoque nem banco externo. O histórico de cheques devolvidos existente é preservado.

A interface em **Demonstrativo de comissões → Correções** permite solicitar, revisar, aprovar ou rejeitar e visualizar o histórico.

## Homologação

A suíte CI valida devolução de cheque após fechamento, valor originalmente aprovado imutável, solicitação por financeiro, aprovação por gestor, recusa, prevenção de solicitações simultâneas, bloqueio da quitação pendente, histórico isolado por empresa, vedação a ajustes após pagamento e auditoria única.

Não publicar na VPS sem backup do PostgreSQL e homologação com a gestão. Migração aditiva, sem alteração retroativa dos lançamentos.
