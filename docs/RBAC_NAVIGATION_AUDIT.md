# Autorização coerente entre menu e páginas do ERP

## Defeito observado

O menu principal oferecia Produtos & Estoque para FINANCE (sem inventory:read), apesar de a API negar acesso. A própria página de produtos não negava esse papel durante a renderização SSR. O menu de Relatórios & BI também aparecia para MANAGER sem reports:read, embora a rota negasse acesso. A interface induzia a erro.

## Correção

- ModuleShell aceita MembershipRole tipado e usa hasPermission para links de Produtos, Relatórios, Financeiro, Recebíveis, Integrações e Promoções.
- A rota /products recusa no servidor qualquer papel sem inventory:read, independente da UI. APIs permanecem protegidas.
- Nenhum papel ganhou novos privilégios; a correção somente alinha navegação e autorizadores.
- Layout e estilos existentes preservados.

## Teste automático

O comando pnpm test:smoke-page-rbac cria usuários temporários FINANCE e MANAGER em um tenant descartável:

- FINANCE: /products responde 404 e /api/products responde 403; menu oculta estoque, mantendo relatórios e financeiro.
- MANAGER: vê produtos/financeiro, mas sem reports:read a rota /reports responde 404 e seu link não aparece.
- Ações administrativas não são expostas sem autorização; anônimo é redirecionado.
- Limpeza apaga apenas as contas e sessões temporárias.

A comparação visual Stitch permanece gate separado.