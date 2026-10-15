# Cheques devolvidos e recuperações — Módulo 2

## Entregue

O pagamento original por cheque **quitado** continua imutável. Em caso de devolução bancária, a equipe com permissão `finance:write` registra data e motivo. Essa operação gera evento próprio, vinculado ao pagamento, com auditoria; uma segunda devolução do mesmo cheque é recusada. Cheques ainda pendentes continuam no contas a receber habitual e **não** podem gerar uma devolução duplicada.

A devolução gera um valor a recuperar equivalente ao cheque originalmente quitado. O financeiro pode registrar recuperações parciais por Pix, dinheiro, cartão ou transferência, cada uma com data, valor, usuário e identificador de idempotência. O valor recebido jamais pode exceder o montante devolvido; quando a soma atinge o total, o caso passa automaticamente a **totalmente recuperado**. Reenvios idênticos com a mesma chave não duplicam os créditos.

**Fluxo de caixa por período:** o recebimento original permanece na data em que foi registrado; a devolução gera lançamento contábil de estorno na data da ocorrência; cada recuperação gera nova entrada em sua data. Assim o total líquido não conta o mesmo cheque em dobro. O relatório financeiro consolida o saldo em aberto dos cheques devolvidos em contas a receber e mostra os valores de estorno/recuperação por período. A API de contas a receber preserva o campo `receivables` e acrescenta `returnedCheques` em campo separado.

**Acesso:** somente perfis com `finance:write` podem registrar devoluções e recuperações. A consulta é restrita a `finance:read`. Vendedoras apenas veem indicação de cheque devolvido em vendas, sem dados privados de cobrança. Todas as consultas e operações são isoladas por empresa, inclusive no banco.

## Limitações operacionais

- O pagamento original e suas conciliações bancárias históricas **não são apagados**, nem alterados automaticamente. Uma nova conciliação do cheque devolvido fica bloqueada. Estorno e recuperação aparecem no **fluxo de caixa comercial**; a conciliação do lançamento bancário real de devolução/recuperação exige fluxo adicional e revisão pelo financeiro.
- Não há baixa/reabertura automática do estágio `PAID` do pedido, estorno de comissões já pagas, novo cheque substituto, cobrança automática no WhatsApp nem reabertura de limite de crédito. A pendência financeira é rastreada no evento separado.
- Recuperação só pode ser lançada após recebimento efetivo, com data não futura. Não são lançados pagamentos automáticos nem débitos bancários externos.
- Débito avulso não vinculado a cheque ainda não foi implementado. Esta entrega cobre especificamente cheques devolvidos.
- É necessária homologação com cheques reais e avaliação das integrações contábeis antes de produção.

## Validação

Smoke inclui: 401 sem login, vendedor sem permissão, devolução única, cheque conciliado preservado, bloqueio de nova conciliação, aumento do contas a receber, estorno datado, recuperação parcial, idempotência, chave reutilizada com dados diferentes, rejeição de excesso, recuperação total, isolamento entre empresas e preservação do status/histórico originais.

O CI trabalha em banco isolado; não altera o PostgreSQL da VPS. Fazer backup e preparar homologação financeira antes do próximo deploy.
