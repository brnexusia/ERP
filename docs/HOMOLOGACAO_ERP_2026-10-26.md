# ERP Pedro — registro de validação técnica e pendências de homologação

**Data:** 26/10/2026  
**Fonte funcional:** `ERP_Pedro_Escopo_Oficial.pdf`, versão consolidada de 15/09/2026  
**Fonte visual obrigatória:** telas e design system do Stitch aprovado (ainda sem pacote exportável completo no repositório)  
**Branch de integração:** `feat/erp-unified-regression-hardening-20261026` — PR #42  
**Branch incremental:** `feat/promotion-draft-registry-20261026` — PR #43
**Branch de alertas:** `feat/operational-alert-center-20261026` — PR #44
**Branch de inteligência do cliente:** `feat/client-category-insights-20261026` — PR #45

## Critério de status

- **Validado tecnicamente:** implementado, executado em ambiente descartável do GitHub Actions, com pipeline verde para o commit indicado.
- **Em homologação:** parte funcional implementada e testada, mas aprovação visual ou teste em ambiente de negócio ainda não realizado.
- **Bloqueado por insumo:** impossível completar corretamente sem regra comercial/contrato técnico/credencial/design original; não substituir por suposições.
- **Produção não autorizada:** nenhum PR mesclado ou deploy realizado por esta entrega.

## Matriz por etapa do documento-fonte

| Etapa | Cobertura técnica exercitada | Gate ainda pendente |
|---|---|---|
| **1. Gestão de Clientes** | Cadastro, CPF/CNPJ/endereço, crédito, vale, segmentação, inatividade por dias configurados na central `/alerts`, CRM, perfil central, login, RBAC, isolamento de empresa e smoke `test:module-1` / cadeia de smokes no CI | VaxChat/VaxLab reais, comparação visual Stitch e aceite funcional de operação |
| **2. Vendas, Relatórios e Comissões** | Fluxo orçamento → pedido → pagamento, canais, pagamentos, vencimentos, perfil da vendedora, metas explícitas, descontos aprovados, cheques, comissões auditadas, SAC, entregas, dashboard e relatórios; smoke integrado CI | Contratos de envio de rastreio por e-mail/WhatsApp; fórmula de comissão conforme decisões aplicáveis; validação visual e negócio |
| **3. Produtos e Estoque** | Categorias, produtos, fotos, estoque e limites, alerta automático in-app de estoque mínimo, catálogo público com custo oculto, indicadores por período, curva factual, baixa saída parametrizada, análise de categorias no perfil do cliente e histórico real das formas de pagamento; smoke UI e verificação seller/tenant | Faixas ABC, limiares automáticos, baixa física/reserva de estoque, descontos progressivos e aceite Stitch |
| **4. Integrações, Promoções e Financeiro** | Configuração isolada de provedores, financeiro e conciliação manual, fluxos de caixa e relatórios; rascunhos de promoções por produto/categoria/valor/quantidade com isolamento e auditoria; smoke CI | Integrações reais, política de precificação promoções, automação bancária se solicitada, domínio/DNS/TLS/VPS e aceite visual |

## Garantias que a CI efetivamente exercita

1. Prisma Client gerado e schema validado; migrations aplicadas em PostgreSQL 17 temporário.
2. Criação do primeiro tenant de CI e verificações do isolamento multiempresa/roles.
3. Verificação estática TypeScript; build Next.js completo.
4. Verificação sintática de scripts `ops/*.sh` e sintaxe do Docker Compose de produção.
5. Round-trip de **backup + checksum SHA-256 + restore** do PostgreSQL.
6. Round-trip de **backup + checksum SHA-256 + restore** dos arquivos persistentes.
7. App iniciado localmente pela CI: healthcheck e smoke HTTP para autenticação, gestão de clientes, produtos, vendas, suporte, dashboards, relatórios, financeiro, integrações e novos workspaces.
8. `smoke-product-workspace`: acesso autenticado, catálogo HTML, link público, token inválido e sigilo de custo.
9. `smoke-product-intelligence-page`: autorização de relatórios/indicadores.
10. `smoke-promotion-drafts`: tipos de rascunho, proibição de mutação pela vendedora, vínculos produto/categoria válidos, bloqueio entre tenants via API e SQL, preservação de preço e vendas, autoria restrita ao tenant.

**Evidência da consolidação:** CI verde [#40349533748](https://github.com/brnexusia/ERP/actions/runs/40349533748), commit `421fc09d70a7fd688917f8c530dcefd039303bf0`.

**Evidência da etapa de rascunhos e proteções multiempresa:** CI verde [#40355778435](https://github.com/brnexusia/ERP/actions/runs/40355778435), commit `a6431b006dc35b67d389998bfed702c793563349`.

**Evidência da Central de Alertas:** CI verde [#40361886771](https://github.com/brnexusia/ERP/actions/runs/40361886771), commit `7331f4177f13d22bc9839b96fe84e2df69782b67`.

**Evidência de categorias e pagamentos no perfil central:** CI verde [#40362915382](https://github.com/brnexusia/ERP/actions/runs/40362915382), commit `896d1861647c6306e825a7863db05324c085fb16`.

> Executar novamente a CI após qualquer alteração. Um pipeline verde não constitui, por si só, homologação visual Stitch, aceite de regras comerciais, prova de carga em VPS real nem certificação de integração externa.

## Checklist para aceite definitivo

- [x] Escopo rastreado por requisito em `docs/SCOPE_TRACEABILITY.md`.
- [x] Branches e PRs isolados, sem publicação automática.
- [x] Suite técnica integrada, migrações e mecanismos de recuperação testados nos commits citados.
- [x] Redação de custos para papéis sem acesso gerencial, testada em consulta de produtos e estoque baixo.
- [x] Cadastro de intenções de promoções sem aplicação comercial não autorizada.
- [x] Alertas in-app de cliente inativo/estoque mínimo, sem exposição de custo ou dados cross-tenant.
- [x] Categorias predominantes e histórico dos meios de pagamento reais visíveis no perfil central.
- [ ] Comparação visual documentada com todas as telas completas exportadas do Stitch, inclusive mobile.
- [ ] Contratos, credenciais, ambiente de teste e idempotência dos sistemas externos.
- [ ] Decisões formais faltantes registradas em `docs/DECISIONS_REQUIRED.md`.
- [ ] Testes de ponta a ponta com dados reais autorizados/anonimizados e aceite operacional de Pedro/Vax/Arles.
- [ ] Avaliação de segurança, carga, observabilidade, retenção offsite e plano de rollback do VPS final.
- [ ] Revisão dos PRs e merge controlado após as dependências (`#45` depende de `#44`, que depende de `#43`, que depende de `#42`; os PRs `#38–#41` são alternativas/insumos da consolidação).
- [ ] Autorização expressa antes de colocar o ERP em produção.

**Conclusão:** etapa de engenharia automatizada validada nos commits acima; **homologação final do produto e implantação permanecem abertas** enquanto houver bloqueios listados.
