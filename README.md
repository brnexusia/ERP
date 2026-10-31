# ERP Pedro

ERP web multiempresa para a operação Pedro, com arquitetura preparada para futura comercialização pela Vax/Arles.

## Fontes oficiais

- **Escopo funcional:** `ERP_Pedro_Escopo_Oficial.pdf` (documento-fonte do projeto).
- **Referência visual:** Stitch aprovado. O Stitch prevalece para layout, componentes, navegação e comportamento visual.
- **Regra de execução:** nenhuma funcionalidade aprovada deve ser removida ou alterada silenciosamente; mudanças de escopo devem ser registradas.

## Estado atual

A fundação técnica está fechada e o backend funcional já cobre grande parte das quatro etapas do documento-fonte: clientes/CRM/crédito/vale, produtos/estoque, fluxo `orçamento → pedido → pagamento`, pagamentos, suporte/entrega, relatórios, dashboard agregado, financeiro, configuração de integrações, gestão multiempresa, provisionamento e infraestrutura de produção.

Continuam deliberadamente pendentes os itens que dependem de informação que o projeto ainda não forneceu: fórmulas de comissão/metas/promoções, critérios de baixa saída/Curva ABC/redução de compras/auto-atacado, momento da baixa física de estoque, contratos técnicos das integrações externas, domínio/VPS definitivos e a referência detalhada do Stitch para fechamento visual.

O ERP não transforma essas lacunas em regra de negócio por suposição.

## Segurança e isolamento

- tenant ativo resolvido no servidor;
- consultas operacionais escopadas por empresa;
- RBAC por membership/papel;
- troca autenticada de senha com verificação da senha atual, revogação das sessões paralelas e auditoria;
- gestão de usuários tenant-scoped;
- auditoria administrativa;
- PostgreSQL não exposto pela stack de produção;
- armazenamento de arquivos persistente e separado do banco;
- arquivos privados protegidos por sessão, tenant e permissão;
- tokens de arquivo assinados;
- backup/restore de banco e arquivos;
- healthcheck de banco + storage;
- cabeçalhos HTTP básicos de endurecimento.

## Navegação da documentação

- `docs/PROGRESS.md` — estado dos 15 progressos;
- `docs/SCOPE_TRACEABILITY.md` — requisito oficial → implementação → progresso;
- `docs/DECISIONS_REQUIRED.md` — regras ainda não definidas pelo escopo;
- `docs/ARCHITECTURE.md` — arquitetura, isolamento, storage e segurança;
- `docs/PROVISIONING.md` — criação controlada de novas empresas;
- `docs/PRODUCTS_WORKSPACE.md` — operação de produtos, estoque e catálogo público;
- `docs/INTEGRATIONS_REGISTRY_WORKSPACE.md` — painel de registros de provedores, sem simular conexões reais;
- `docs/FINANCE_WORKSPACE.md` — operação financeira com conciliação manual e permissões;
- `docs/PRODUCT_INTELLIGENCE_WORKSPACE.md` — dados de vendas por produto, participação factual e limiar informado;
- `docs/PROMOTION_DRAFT_REGISTRY.md` — rascunhos auditados de promoções sem aplicação de preço;
- `docs/OPERATIONAL_ALERT_CENTER.md` — central privada de inatividade e estoque mínimo com detecção na consulta;
- `docs/CLIENT_CATEGORY_INSIGHTS.md` — análise de categorias e histórico efetivo de pagamentos no perfil do cliente;
- `docs/DASHBOARD_PERIOD_FILTER.md` — seleção de período sem distorcer o estoque/inatividade atual;
- `docs/RBAC_NAVIGATION_AUDIT.md` — alinhamento entre links de navegação e autorização nas páginas;
- `docs/FINANCIAL_MOVEMENTS_RBAC.md` — permissão mínima para alterações manuais de crédito e vale;
- `docs/REPURCHASE_CALENDAR_BOUNDARIES.md` — datas-limite precisas da recompra factual em três meses-calendário;
- `docs/ABC_EXPLICIT_CLASSES.md` — classificação ABC por faixas escolhidas na consulta, sem política comercial automática;
- `docs/COMMERCIAL_RATE_API_PRIVACY.md` — confidencialidade de percentuais comerciais nas APIs, com smoke de perfis;
- `docs/SELLER_MEMBERSHIP_PRIVACY.md` — redução de exposição de taxas comerciais em vínculos de vendedoras;
- `docs/SECURITY_PROJECTIONS_GATE.md` — política de projeção segura de usuários, auditoria e CI;
- `docs/BROWSER_E2E_HOMOLOGATION.md` — navegação real em Chromium desktop/mobile, screenshots e limites da homologação;
- `docs/HOMOLOGACAO_ERP_2026-10-26.md` — evidências da CI por etapa, lacunas de aceite e gate de liberação;
- `docs/PRODUCTION_DEPLOYMENT.md` — implantação, persistência, backup e recuperação.

## Princípio de arquitetura

Toda entidade operacional de clientes, vendedores, produtos, estoque, vendas, financeiro, integrações e arquivos deve pertencer explicitamente a uma empresa/tenant ou estar inequivocamente ligada a uma entidade que pertença. A aplicação nunca deve misturar operações entre empresas.

## Regra visual

As telas de desenvolvimento permanecem provisórias até existir referência suficiente do Stitch aprovado. Nenhuma interface é marcada como final apenas porque o backend correspondente já está funcional.
