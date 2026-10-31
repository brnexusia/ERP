# Controle de exposição de dados de usuário — gate de segurança

## Risco mitigado

A tabela `User` mantém `passwordHash` para autenticação. Relações Prisma carregadas com `include: { user: true }` ou formas equivalentes retornam **o registro completo**, inclusive campos que não devem chegar ao cliente HTTP.

Foram substituídos carregamentos integrais por `select` explícito de `id`, `name`, `status` e eventualmente `email` quando necessário, nos fluxos de clientes, relatórios, ranking, vendas, financeiro, sessão e contexto multiempresa. As respostas do ERP não devem conter hashes de senha.

## Proteção permanente

O script `scripts/verify-user-projections.ts` percorre AST TypeScript/TSX das pastas `app/`, `lib/`, `modules/`, rejeitando relações User com valor `true` em consultas (nomes de ator e `user` sem projeção). **Toda relação com um usuário deve escolher explicitamente os campos necessários.**

- Comando independente: `pnpm test:security-projections`
- CI: job ERP CI, após a análise de tipos, antes do build.
- Autoteste do verificador: entradas inseguras `user: true` e `createdBy: true` devem ser identificadas; entrada segura com `select` deve passar.
- Smoke HTTP: `smoke-client-management`, `smoke-sales`, `smoke-finance`, `smoke-central-client-profile` e `smoke-alert-center` rejeitam `passwordHash` na resposta.

O controle limita uma classe específica de vazamento acidental e não substitui auditoria de endpoints, testes de invasão ou análise de autorização em produção.

## Consolidação

A branch `feat/erp-unified-acceptance-security-20261026` reúne as entregas funcionais dos PRs #42–#49 e a correção de segurança do PR #50. Como há arquivos sobrepostos, **não mesclar em duplicidade PRs antigos e branch consolidada**. Validar seu commit final e proceder com revisão/merge controlado, preservando o histórico.

## Homologação

CI verde = validação técnica em ambiente descartável; não equivale a implantação nem a aceite comercial/visual. Restam Stitch completo, políticas de negócio ainda sem definição, contratos/credenciais para integrações reais, e ambiente e responsáveis de homologação.
