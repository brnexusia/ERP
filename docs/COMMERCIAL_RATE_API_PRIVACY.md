# Sigilo das taxas comerciais nas APIs de vendas e representantes

## Problema confirmado

A regra de privacidade das vendedoras já ocultava `Membership.commissionPercent` na listagem normal para perfis sem acesso financeiro. No entanto, `GET /api/representatives` retornava `Representative.commissionPercent` e algumas respostas de vendas, compras e perfis continham percentuais congelados `Sale.sellerCommissionRate` e `Sale.representativeRate`. Esses percentuais podiam ser recebidos por papéis com apenas `sales:read` ou `clients:read`, incluindo SELLER.

## Controle implementado

- Para OWNER, ADMIN, MANAGER e FINANCE, preservar integralmente percentuais comerciais necessários à operação financeira.
- Para SELLER, SUPPORT e VIEWER, retirar das respostas JSON as chaves `commissionPercent`, `sellerCommissionRate` e `representativeRate` nos fluxos de venda, alteração de orçamento, confirmação, pagamentos, compras do cliente, perfil central/comercial e perfil da vendedora.
- Na listagem de representantes, consultar percentuais somente para perfis com autorização financeira. Em cadastro e alerta de inatividade, a relação com representante só carrega identidade/nome/contato.
- A transformação é exclusiva da camada HTTP: **o banco de dados, o cálculo, a taxa congelada em pedido e os fechamentos permanecem inalterados**.
- Os dados não confidenciais, incluindo valores das vendas e pagamentos, continuam disponíveis segundo os demais controles de acesso.

## Evidência de regressão

`pnpm test:smoke-commercial-rate-privacy` cria em um tenant descartável uma vendedora com comissão de 1,75%, um representante com 7,25%, cliente, produto e pedido pago. A suíte confirma que o OWNER consegue consultar os percentuais legítimos de uma venda e cadastro do representante, enquanto a vendedora não os recebe em APIs de representantes, clientes, pedidos e perfis comerciais (nem nas compras pagas). O teste remove fixtures ao final.

## Riscos e dependências ainda não fechados

Uma política completa de segregação exige revisar as demais rotas especializadas (descontos, demonstrativos de comissão, trilhas de auditoria e endpoints do financeiro) com as definições oficiais de quem pode visualizar valores e percentuais. Esta entrega cobre explicitamente as rotas listadas acima; não constitui um pentest nem homologação financeira definitiva.

Além disso, são necessárias regras oficiais para cálculo/comissão, Stitch aprovado integral, provedores reais e aceite de produção, conforme `docs/DECISIONS_REQUIRED.md` e `docs/HOMOLOGACAO_ERP_2026-10-26.md`.
