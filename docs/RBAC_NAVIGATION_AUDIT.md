# Autorização coerente entre menu e páginas do ERP

## Defeito observado

O menu principal oferecia Produtos & Estoque para FINANCE (sem inventory:read), apesar de a API negar acesso. A própria página de produtos não negava esse papel durante a renderização SSR. Para Relatórios & BI, a verificação confirmou que MANAGER já possui reports:read; a regra de navegação passou a consultar explicitamente a mesma matriz RBAC do servidor, prevenindo divergência futura.

## Correção

- ModuleShell aceita MembershipRole tipado e usa hasPermission para links de Produtos, Relatórios, Financeiro, Recebíveis, Integrações e Promoções.
- A rota /products recusa no servidor qualquer papel sem inventory:read, independente da UI. APIs permanecem protegidas.
- Nenhum papel ganhou novos privilégios; a correção somente alinha navegação e autorizadores.
- Layout e estilos existentes preservados.

## Teste automático

O comando pnpm test:smoke-page-rbac cria usuários temporários FINANCE, MANAGER e SUPPORT em um tenant descartável:

- FINANCE: /products responde 404 e /api/products responde 403; menu oculta estoque, mantendo relatórios e financeiro.
- MANAGER: vê produtos, financeiro e relatórios, conforme reports:read explicitamente concedido no RBAC.
- SUPPORT: vê produtos, mas sem reports:read nem finance:read recebe 404 em relatórios/financeiro e não vê esses links.
- Ações administrativas não são expostas sem autorização; anônimo é redirecionado.
- Limpeza apaga apenas as contas e sessões temporárias.

A comparação visual Stitch permanece gate separado.