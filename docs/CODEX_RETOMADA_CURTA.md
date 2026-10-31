# Codex — Retomada de sessão com contexto reduzido (ERP Pedro)
Atualizado em 2026-10-31. Este arquivo serve para **executar**, não para replanejar o ERP.

**Fonte oficial de código**: `brnexusia/ERP`, branch `main`, clone `https://github.com/brnexusia/ERP.git`.
**Prompt-mestre completo já versionado**: `docs/CODEX_CONTINUAR_FINALIZAR.md`. Escopo oficial em `docs/references/ERP_Pedro_Escopo_Oficial.texto.md`. Progresso em `docs/PROGRESS.md`. Decisões pendentes em `docs/DECISIONS_REQUIRED.md`. Design final obrigatório: Stitch aprovado, não inventar substitutos.

## O que foi confirmado fora da sessão Codex
- `main` existente e acessível; em 31/10/2026, cabeça observada `23e737d2d8da2ac819629a67e8369a654ea1617f`. **Revalidar o SHA antes de executar**.
- GitHub Actions `ERP CI` concluiu com sucesso no SHA acima. Isso NÃO prova homologação, deploy ou execução local.
- `docs/PROGRESS.md`: fundação ✅; clientes/crédito/vale/CRM em homologação 🔵; produtos/estoque, vendas/pagamentos/entregas/financeiro com bases funcionais; Stitch, integrações externas e homologação geral pendentes.
- Sessão Codex anterior esgotou contexto antes de clonar ou testar. Nenhuma implementação foi relatada nessa sessão. Não tratar o relatório como commit.

## PRIMEIRA AÇÃO DESTA NOVA SESSÃO — não gastar contexto repetindo uma auditoria extensa
1. Verificar `pwd; ls -la; git status -sb; git remote -v` no workspace apropriado. Se pasta vazia, clonar: `git clone https://github.com/brnexusia/ERP.git erp-pedro`, entrar no diretório. Se já clonado, **não clonar por cima**; inspecionar alterações locais antes de `git pull --ff-only`.
2. Ler apenas estas partes, de modo sequencial e com saída limitada: `README.md`, tabela de marcos e gate da Etapa 1 em `docs/PROGRESS.md`, `docs/MODULE_1_CLOSEOUT.md`, `package.json`, e trechos relevantes de `docs/CODEX_CONTINUAR_FINALIZAR.md`. Usar `sed`/`rg` para buscar seções específicas. **Não despejar tudo num único contexto nem reler o ZIP/PDF completo**.
3. Preparar dependências e PostgreSQL de teste conforme Docker/README, sem tocar em produção; executar `pnpm db:generate`, `pnpm typecheck`, `pnpm build`, `pnpm test:foundation` e `pnpm test:module-1`, conforme viabilidade. Guardar status, comando e trecho da falha. Não relatar executado o que não rodou.
4. Escolher **uma falha real ou pendência técnica verificável da Etapa 1**. Implementar correção, adicionar teste de regressão, executar testes pertinentes, registrar diff e commit/PR. Repetir incrementalmente. Não ficar apenas escrevendo diagnósticos.
5. Depois de cada lote manter `docs/CODEX_CHECKPOINT.md` com SHA de base, mudanças, comandos/testes e resultados, pendências restantes, próximo passo concreto. Nas sessões futuras leia PRIMEIRO esse checkpoint, não todo o histórico. Nunca substituir fatos pelos status documentados.

## Restrições
- Não recriar sistema, não mudar para ERP2/CRM, não apagar módulos existentes, não inventar critérios de comissão/ABC/estoque/promoções; decisões condicionadas ficam registradas em `docs/DECISIONS_REQUIRED.md`.
- Segurança multiempresa, RBAC, auditoria, dados de clientes, arquivos privados e migrations são invariantes. Nunca rodar migrations destrutivas nem restaurar dados em produção.
- **Stitch** e integrações reais dependem de fontes/credenciais externas: continuar a validação técnica independente, mas não declarar tais marcos concluídos sem prova. A documentação atual pede o fechamento controlado da Etapa 1 antes de tratar a Etapa 2 como novo foco.
- Logs, prints, transcrições enormes e arquivos binários devem ficar fora da janela de contexto e fora do Git se incluírem segredos/dados pessoais. Usar resumos e caminhos.
- Se a sessão chegar ao limite, criar checkpoint legível e encerrar somente a sessão, NÃO declarar projeto bloqueado permanentemente.

**Definição de resultado útil nesta retomada:** clone real validado, baseline de testes executado, pelo menos uma correção concreta com teste e commit/PR quando houver falha solucionável, e checkpoint para continuar sem perda de contexto.
