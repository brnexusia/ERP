# Liberação controlada — módulos 1 e 2 disponíveis; 3 e 4 bloqueados

## Regra padrão
O ERP Pedro abre **Clientes/CRM (1)** e **Vendas/Comissões/Relatórios/SAC (2)**, mantendo os módulos **Produtos/Estoque (3)** e **Financeiro/Integrações/Promoções (4)** bloqueados **por padrão**. Nenhum dado, migration ou código dos módulos bloqueados é removido. O menu exibe itens desabilitados e o servidor recusa páginas e APIs mesmo por URL direta.

Variáveis **exclusivamente no ambiente do servidor**:
- `ERP_ENABLE_MODULE_3=false` (default quando ausente)
- `ERP_ENABLE_MODULE_4=false` (default quando ausente)

Para homologar os módulos avançados em ambiente isolado, configure explicitamente o módulo desejado como `true`, gere uma nova build e inicie com a mesma configuração. Não habilitar em produção sem aceite.

## Dependências necessárias dos módulos 1/2
- `GET /api/products` continua disponível **somente** como lookup mínimo de identificador, nome, SKU e preço de venda para cadastro do orçamento; criação/edição/estoque/catálogo/relatórios de produtos ficam bloqueados.
- `GET /api/integrations` continua disponível apenas para leitura de **VaxChat/VaxLab** nas configurações de clientes; POST e painel de integrações ficam bloqueados.
- `/receivables` e APIs `/api/finance/{receivables,manual-receivables,cheque-returns}` são preservadas por integrarem cobrança e cheque do Módulo 2; o módulo financeiro avançado segue bloqueado.
- `/api/files` continua servindo comprovantes de entrega do Módulo 2, mas bloqueia novos uploads de imagem de produto quando o Módulo 3 está desativado.
- Dashboard e Central de Alertas expõem **somente dados dos módulos liberados**: estoque e métricas de caixa não são calculados/exibidos com 3/4 desativados.
- URLs públicas de catálogo são bloqueadas enquanto Módulo 3 estiver desativado. Arquivos previamente publicados e registros internos são preservados.

## Controles e validação
A guarda `lib/module-release.ts` é aplicada via `middleware.ts` a páginas e APIs. Permissões RBAC e tenant seguem obrigatórias após a liberação. O script `pnpm test:module-release` testa bloqueio, acessos necessários e opt-in. O CI usa flags `true` somente no tenant isolado para preservar a regressão das funcionalidades 3/4 que continuam sendo desenvolvidas, enquanto o teste da guarda verifica explicitamente o estado padrão bloqueado.

**Status de negócio inalterado:** liberação de acesso não equivale a homologação de Stitch, integração real ou publicação no EasyPanel.
