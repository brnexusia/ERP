# Tabela administrativa de promoções — somente rascunhos

A fonte oficial exige promoções identificadas por produto, categoria e progressivas por valor ou quantidade. Ela **não** fixa o cálculo, elegibilidade, vigência, combinação, prioridade ou arredondamento das promoções.

Implementação tecnicamente executável sem inventar essas decisões:
- Modelo PostgreSQL `PromotionDraft` com `organizationId`, criador, nome, tipo, produto/categoria opcionais conforme o tipo e observações.
- Quatro tipos de rascunho: `PRODUCT`, `CATEGORY`, `PROGRESSIVE_VALUE`, `PROGRESSIVE_QUANTITY`. Um rascunho **não** possui preço calculado, desconto em percentual, ativação nem vigência.
- `GET /api/promotions`, `POST /api/promotions`, `DELETE /api/promotions/[id]` e painel `/promotions` exclusivo a OWNER/ADMIN (permissão `organization:manage`).
- Registro auditado de criação e exclusão. As ligações de produto/categoria são conferidas por empresa na aplicação e no PostgreSQL com triggers de isolamento.
- Sem integração com `Sale`, `SaleItem`, preços, catálogo público ou checkout. Nenhum rascunho pode alterar valores ou influenciar uma venda.

## Homologação técnica

A CI aplica a migration e executa `pnpm test:smoke-promotion-drafts`: cria os quatro tipos, confirma negação para vendedoras, valida ausência de motor de precificação, rejeita campos financeiros não aprovados, impede vínculo cross-tenant via API e PostgreSQL e confirma que a quantidade de vendas não mudou.

A homologação visual depende de acesso às telas completas do Stitch. **Uma tabela de rascunhos não equivale à engine de promoções final.** O item continua aberto em `docs/DECISIONS_REQUIRED.md`.
