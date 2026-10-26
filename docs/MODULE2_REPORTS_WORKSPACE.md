# Módulo 2 — Relatórios & BI operacional

## Interface e escopo

A página `/reports` ativa o item **Relatórios & BI** para OWNER, ADMIN, MANAGER, FINANCE e VIEWER (permissão `reports:read`, além de acesso comercial e de clientes). É uma interface **somente leitura**, sem novas mutações nem migrações no banco.

Reúne os serviços analíticos já existentes:
- **Vendas pagas:** total liquidado, quantidade, clientes únicos e ticket médio.
- **Canais:** WhatsApp, site e loja física, com quantidade e faturamento.
- **Vendedoras:** vendas pagas, faturamento, clientes e ticket médio.
- **Clientes:** ranking de compras pagas, classificação factual da carteira (sem compra, uma compra e recorrentes) e inatividade conforme `X dias` cadastrado.
- **Comparação de redução de compras:** dois períodos completos e métrica explicitamente informados pelo usuário, sem uma janela, faixa ou limiar presumidos.

Filtros de período: ao abrir a tela, o histórico comercial é apresentado **sem período padrão inventado**. Para escolher uma janela, o usuário informa início e fim. A classificação de clientes utiliza **sempre o histórico total**, independentemente do filtro comercial; isso é avisado na tela. O ticket de novos/antigos só aparece quando há início definido, de acordo com o serviço atual.

A interface usa os componentes e tokens de cor/espaçamento já disponíveis no ERP, mas **não é declarada visualmente idêntica ao Stitch** até revisão lado a lado da referência aprovada. Ranking e comparação exibem até 30 resultados por vez na tela, com busca aplicada ao ranking; todos os cálculos permanecem no backend tenant-scoped.

## Segurança e limitações

Os dados do relatório comercial são de vendas `PAID`. Não são misturados orçamentos, contas avulsas nem comissões fechadas à receita comercial. A página não expõe preços de custo nem acessa as funções financeiras de movimentação.

A comparação não dispara aviso automático e não pressupõe sazonalidade, regra de perda de cliente ou limiar mínimo. Não há exportação CSV nesta entrega. Métricas com muitos registros ainda dependem de avaliação de desempenho antes de produção em escala.

## Verificação

A suíte `scripts/smoke-reports.ts` cobre:
- acesso autorizado à página e redirecionamento sem login;
- consulta comercial sem filtro, rejeição de período inválido;
- ranking e classificação por cliente em dados de teste;
- detecção de redução com dois períodos explícitos;
- regressão dos cálculos de faturamento, canais, ticket e vendedoras.

A execução acontece no banco isolado do CI. Nenhuma alteração de dados ou deploy na VPS é efetuada por este PR.
