# Permissão financeira para movimentações manuais de crédito e vale

## Problema encontrado

As operações `POST /api/clients/:id/credit/movements` e `POST /api/clients/:id/vale/movements` aceitavam **qualquer usuário com `clients:write`**, inclusive SELLER e SUPPORT. Isso permitia a perfis de cadastro e relacionamento alterar manualmente valores monetários. O botão de movimentação também aparecia na UI desses perfis. Essa permissão era mais ampla que o acesso ao limite de crédito, que já era restrito à gestão.

## Contenção implementada

- Movimentações **manuais** de crédito utilizado e saldo de vale exigem papel OWNER, ADMIN, MANAGER ou FINANCE.
- SELLER, SUPPORT e VIEWER não podem lançar movimentos manuais, mesmo que tenham `clients:write`.
- O serviço nega acesso antes de criar qualquer conta/movimento; a UI oculta os formulários para perfis não autorizados.
- As operações de pagamento de venda continuam usando o ledger transacional `modules/sales/payment-ledger.ts` e não passam por esta restrição: cobrança e quitação autorizadas permanecem possíveis segundo as regras próprias da venda.
- Não há alteração de limite, saldos preexistentes ou fórmula comercial por esta mudança.

## Evidência de homologação automatizada

O comando `pnpm test:smoke-client-financial-rbac` cria um cliente temporário com limite de crédito, perfis SELLER, SUPPORT, MANAGER e FINANCE e autentica cada um por API. Verifica:
1. SELLER e SUPPORT recebem HTTP 403 em ambos os endpoints.
2. Tentativas negadas não modificam saldo de crédito nem criam conta de vale ou movimentos auditados.
3. MANAGER e FINANCE podem fazer operações manuais, que atualizam saldos e continuam auditadas.
4. A suíte integrada mantém os testes de venda, pagamento, reserva/liberação automática de crédito e resgate de vale.

## Gate de negócio

A permissão administrativa da operação manual foi endurecida por segurança. Qualquer delegação comercial futura para papéis de vendedores, limites por valor ou fluxo de solicitação/aprovação precisa de uma decisão explícita e trilha auditável; não deve ser incorporada por inferência.

A aprovação técnica da CI **não substitui** o aceite financeiro/operacional do responsável nem as demais pendências registradas em `docs/DECISIONS_REQUIRED.md`.
