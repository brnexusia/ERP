# Homologação automatizada de navegação e responsividade (desktop/mobile)

## Objetivo e escopo

O escopo oficial exige ERP web funcional, responsivo e interface fiel ao Stitch. Este gate acrescenta testes em navegador real para detectar falhas de hidratação, navegação e quebra horizontal, complementando os smoke tests HTTP/Prisma já existentes.

## Execução

- Instala Playwright Chromium na CI temporária, após migrations, seeds, build, backup e restore.
- Roda pnpm test:browser, com viewports desktop (1440×900) e mobile (390×844).
- Verifica anônimo redirecionado para login, credenciais do tenant descartável, entrada no Dashboard Geral, aplicação/remoção do filtro de período, acesso direto às páginas Clientes, Produtos, Alertas, Relatórios, Financeiro, Integrações e Promoções.
- Detecta overflow horizontal no documento e no body (tolerância técnica de 3 px). Layout de tabelas pode ter rolagem dentro do próprio componente, não no viewport inteiro.
- Verifica também **intersecção de retângulos** entre os painéis Performance Comercial e Canais de Venda. A primeira execução em mobile revelou uma sobreposição silenciosa que a métrica de scrollWidth não detectava: uma regra CSS posterior sobrescrevia a media query de 1180px. A correção agora impede essa sobreposição e tem teste de regressão.
- Captura screenshots do Dashboard Geral e da Central de Alertas nas duas viewports. Evidências e traces de erro são armazenados como artifact do GitHub Actions por 14 dias.

## Limites explícitos

- Este teste verifica comportamento observável em um Chromium renderizado, NÃO compara pixels com Stitch, nem substitui a aprovação humana de cores, tipografia, espaçamento e estados visuais.
- Não mede carga de múltiplos tenants, acessibilidade integral, navegadores Safari/Firefox, infraestrutura VPS ou conexão de provedores externos.
- O ambiente é sintético, com dados do seed; nenhuma mensagem e nenhuma transação real são disparadas.
- O gate não deve ser executado na produção.

## Critérios de aceite

Pipeline verde, screenshots inspecionáveis, sem erros em rotas protegidas para OWNER, sem overflow horizontal ou sobreposição entre os painéis principais do Dashboard Geral. A homologação visual exata só fecha com assets Stitch aprovados.
## Navegação contextual dos alertas

`tests/e2e/alert-deep-links.spec.ts` exercita a tela de alertas com cliente e estoque temporários e confere a abertura dos detalhes corretos após clicar em **Consultar cliente** e **Consultar estoque**, em Chromium desktop e mobile. Capturas e traces são anexados ao job em caso de erro; dados criados para o teste são limpos ao final.
