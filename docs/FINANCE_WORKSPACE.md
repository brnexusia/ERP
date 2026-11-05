# Painel operacional financeiro

## Entrega

- Página protegida em `/finance` usando o mesmo shell da plataforma, com métricas de saldo realizado, valores pendentes, atrasos e conciliações.
- Consulta a contas a receber de vendas, contas a pagar, fluxo de caixa realizado e extrato bancário, usando os endpoints existentes.
- Filtro de período **informado explicitamente pelo usuário** para os relatórios e o fluxo de caixa. Listas de títulos e extrato permanecem completas.
- Perfil `finance:write`: cadastro de contas a pagar e lançamento de quitação (com confirmação), registro manual de créditos/débitos bancários e conciliação explícita por pagamento de venda ou conta quitada.
- Perfil `finance:read`: visualiza sem controles de alteração. Sessões SELLER/SUPPORT recebem 404 na página e erro de autorização nos endpoints. Regras de valor, direção bancária, status e isolamento continuam centralizadas nos serviços.
- Nenhuma conexão bancária, aprovação automática, taxa, conciliação por suposição ou regra comercial foi criada.

## Testes

- `pnpm typecheck` e `pnpm build` devem completar na CI.
- `pnpm test:smoke-finance-workspace` cobre acesso anônimo, SSR autorizado, API financeira e negação para vendedor real autenticado.
- `pnpm test:smoke-finance` existente preserva testes de pagamento, recebimento, conciliação, limites e isolamento.

## Critérios de homologação pendentes

- A interface é operacional, mas comparação visual com os arquivos do Stitch exportáveis é obrigatória antes de declarar a tela definitiva.
- Conciliação bancária **automática**, PIX/gateway e comunicação com provedores reais dependem dos contratos técnicos/credenciais, não sendo representadas como operantes.
