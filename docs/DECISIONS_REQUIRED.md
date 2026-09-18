# Decisões necessárias — ERP Pedro

Este arquivo registra requisitos do documento-fonte que ainda não possuem critério, fórmula, prioridade ou momento de aplicação suficientemente objetivos. A finalidade é impedir que o desenvolvimento transforme suposições em regra de negócio.

## Princípio

Quando o escopo define **o que** deve existir, mas não define a regra necessária para automatizá-lo, a base técnica pode avançar; o comportamento final permanece pendente até existir decisão rastreável.

## 1. Clientes que reduziram compras

**Já existe:** histórico de compras pagas, faturamento, número de compras, primeira/última compra, ranking e filtros. Sem compra/novo/recorrente e “parou de comprar” já são factuais. Também existe comparação explícita entre dois períodos escolhidos pelo usuário, com métrica `REVENUE` ou `PURCHASES`, indicando factual e matematicamente redução/aumento/estabilidade.

**Falta definir para uma regra automática padrão:** períodos padrão; métrica padrão; eventual limiar mínimo; tratamento de sazonalidade e de cliente sem período anterior completo.

## 2. Produtos com baixa saída

**Já existe:** quantidade vendida, faturamento, vendas pagas, última venda e estoque, com filtro por período. Também existe relatório explícito em que o usuário informa período, métrica (`REVENUE`, `SOLD_QUANTITY` ou `PAID_SALES`) e limiar máximo; o sistema identifica factual e somente nesse contexto os itens iguais ou abaixo do limiar.

**Falta definir para uma regra automática padrão:** janela padrão; métrica padrão; limiar padrão; tratamento especial de item novo/sem venda; frequência e comportamento do alerta.

## 3. Curva ABC

**Já existe:** faturamento, quantidade vendida e estoque por produto. Também existe distribuição factual por período explícito com ranking, participação e participação acumulada, usando `REVENUE` ou `SOLD_QUANTITY` conforme escolha do usuário.

**Falta definir:** faixas A/B/C e qualquer regra final de classificação, incluindo eventual peso combinado, frequência/padrão de período e política de recálculo. Nenhum padrão de mercado será adotado silenciosamente.

## 4. Comissões

**Já existe:** venda/pagamento ligados à vendedora, performance, metas e faturamento factual por vendedora.

**Falta definir:** percentual/fórmula; base; diferenças por produto/categoria/vendedora; momento de reconhecimento; cancelamento/devolução/desconto/pagamento parcial; competência e fechamento.

## 5. Metas por vendedora — decisão estrutural resolvida

O documento exige definição/acompanhamento de metas e cita vendas, faturamento, clientes, metas e indicadores individuais, mas não fixa periodicidade.

A implementação adotada exige que cada meta informe:
- vendedora;
- métrica entre `REVENUE`, `SALES` ou `CLIENTS`, todas expressamente suportadas pela fonte;
- valor-alvo;
- `startAt` e `endAt` explícitos;
- observação opcional.

O realizado usa somente vendas `PAID`. O ERP calcula realizado, percentual de atingimento, atingida/não atingida e estado temporal. Não existe recorrência mensal/semanal/diária automática por suposição.

**Continua fora desta decisão:** outras métricas, recorrência automática e qualquer regra de comissão. A decisão detalhada está em `docs/decisions/seller-goals.md`.

## 6. Auto-atacado

**Já existe:** histórico real de compras e datas por cliente, além do sinal factual de recompra em até três meses-calendário baseado somente em vendas `PAID`, com intervalos preservados.

**Falta definir:** efeito comercial da classificação, eventual quantidade mínima de recompras, duração/expiração da condição e interação com preços, descontos e promoções.

## 7. Baixa física de estoque

**Já existe:** estoque atual/mínimo/máximo, orçamento, pedido e venda paga.

**Falta definir:** momento da baixa física (pedido, pagamento, separação/expedição ou outro), reserva durante orçamento/pedido e reversões por cancelamento/estorno.

## 8. Promoções e descontos progressivos

**Falta definir:** fórmula (percentual, valor fixo, preço especial etc.); combinação e prioridade; arredondamento; vigência; aplicação automática/manual; interação com vale, crédito e demais condições.

A engine definitiva só será construída após essa decisão.

## 9. Integrações externas

**Escopo:** VaxChat, VaxLab, GoPage, ShopVax, WhatsApp, gateways e e-commerce.

**Já existe:** configuração tenant-scoped, estado da integração, referência de segredo sem exposição, auditoria e isolamento.

**Falta para cada provedor:** documentação/API oficial; URL; autenticação; credenciais/secret refs; webhooks/eventos; IDs externos; retry/idempotência; ambientes de homologação/produção. Uma configuração não é marcada como conexão real.

## 10. Envio de rastreio por e-mail/WhatsApp

**Já existe:** código de rastreio e estrutura logística.

**Falta:** provedor de e-mail; integração WhatsApp; remetente/número; template aprovado; gatilho/reenvio.

## 11. Conciliação bancária automática

**Já existe:** conciliação manual funcional e protegida contra cross-tenant no PostgreSQL.

**Se houver automação/importação**, falta: banco/provedor, formato/API, identificadores, matching, tolerâncias e múltiplas correspondências.

## 12. Interface final / Stitch

**Fonte visual obrigatória:** Stitch aprovado.

**Já existe:** backend e telas provisórias de desenvolvimento.

**Falta para fechamento:** referência detalhada/exportável de shell/sidebar, tipografia, tokens, espaçamentos, cards, tabelas, filtros, campos, botões/ícones, modais/estados, responsividade, Dashboard Geral, Clientes & CRM, Produtos & Estoque e padrões para novas telas.

## 13. Produção, domínio e comercialização

**Já existe:** multiempresa, autenticação/permissões, provisionamento técnico de empresa + primeiro `OWNER`, Docker/Compose, PostgreSQL/arquivos persistentes, backup/restore e validação de recuperação.

**Falta definir/fornecer:** VPS definitiva; domínio; DNS/TLS; conta/e-mail empresarial; contratação; planos; cobrança; gatilho comercial de provisionamento; suspensão/cancelamento; política de usuários existentes; retenção/offsite final dos backups.

A stack de deploy não significa que produção já está implantada, e provisionamento técnico não equivale a contratação automática.

---

## Regra de fechamento

Quando uma decisão pendente for aprovada, ela deve ser registrada antes ou junto da implementação. Alterações futuras devem preservar rastreabilidade e não modificar silenciosamente regras já aprovadas.
