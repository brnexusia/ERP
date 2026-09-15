# Decisões necessárias — ERP Pedro

Este arquivo registra pontos exigidos pelo documento-fonte que ainda não possuem regra objetiva suficiente para uma implementação definitiva. A finalidade é impedir que o desenvolvimento transforme suposições em regra de negócio sem aprovação.

## Princípio

Quando o escopo determina **o que** deve existir, mas não define critério, fórmula, prioridade ou momento de aplicação, a base técnica pode ser preparada, porém o comportamento final permanece pendente até a decisão ser registrada.

## 1. Clientes que reduziram compras

**Fonte funcional:** classificação comercial deve identificar clientes que reduziram compras.

**Já existe:** histórico real de compras pagas, faturamento, quantidade de compras, primeira/última compra, ranking e filtros por período.

**Falta definir:**
- quais períodos devem ser comparados;
- se a redução é medida por faturamento, quantidade de pedidos, quantidade de itens ou combinação;
- percentual/valor mínimo de queda para classificar como redução relevante;
- tratamento de sazonalidade ou clientes sem período anterior completo.

## 2. Produtos com baixa saída

**Fonte funcional:** identificar produtos vendendo pouco e gerar alertas/indicadores.

**Já existe:** quantidade vendida, faturamento, quantidade de vendas pagas, última venda e estoque atual por produto, com filtro por período.

**Falta definir:**
- janela de análise;
- limite de vendas/quantidade/faturamento considerado baixa saída;
- se produto sem nenhuma venda entra automaticamente;
- tratamento de produto novo;
- frequência de geração do alerta.

## 3. Curva ABC

**Fonte funcional:** classificar produtos por importância, faturamento e giro.

**Já existe:** dados reais de faturamento e quantidade vendida por produto; dados de estoque também estão disponíveis.

**Falta definir:**
- faixas A/B/C;
- peso de faturamento, quantidade/giro e demais fatores;
- período de cálculo;
- critério de desempate;
- frequência de recálculo.

Nenhum padrão convencional de mercado será adotado silenciosamente.

## 4. Comissões

**Fonte funcional:** página de comissões e desempenho/comissionamento por vendedora.

**Já existe:** venda e pagamento ligados à vendedora, faturamento e performance por vendedora.

**Falta definir:**
- percentual ou fórmula;
- base de cálculo;
- regras diferentes por produto/categoria/vendedora, se existirem;
- momento de reconhecimento: pedido, pagamento, entrega ou outro evento;
- tratamento de cancelamento, devolução, desconto e pagamento parcial;
- competência e fechamento.

## 5. Metas por vendedora

**Fonte funcional:** definição/acompanhamento de metas e indicadores de performance.

**Já existe:** vendas, faturamento, clientes únicos e ticket médio por vendedora.

**Falta definir:**
- métrica da meta: faturamento, quantidade de vendas, clientes, produtos ou outra;
- periodicidade;
- possibilidade de múltiplas metas simultâneas;
- regra de atingimento/parcial;
- tratamento de troca de vendedora durante o período.

## 6. Auto-atacado

**Fonte funcional:** classificação/regra baseada em recompra dentro de período de até 3 meses.

**Já existe:** histórico real de compras e datas por cliente.

**Falta definir:**
- quantas recompras qualificam o cliente;
- se qualquer recompra em até 3 meses basta;
- se o período é contado da primeira, última ou de cada compra;
- quando a classificação expira;
- qual efeito comercial a classificação produz.

## 7. Baixa física de estoque

**Fonte funcional relacionada:** estoque deve refletir a operação de produtos e vendas.

**Já existe:** estoque atual, mínimo/máximo, itens de orçamento/pedido e venda paga.

**Falta definir:** momento oficial da baixa física:
- ao confirmar o pedido;
- ao receber pagamento;
- ao separar/expedir;
- ou outro evento.

Também falta definir cancelamento/estorno e eventual reserva de estoque durante o orçamento/pedido.

## 8. Promoções e descontos progressivos

**Fonte funcional:** promoções por categoria/produto e progressivas por valor/quantidade; descontos progressivos por quantidade, categoria ou volume, incluindo exemplo de dúzia fechada.

**Falta definir:**
- efeito da promoção: percentual, valor fixo, preço unitário especial ou outra fórmula;
- possibilidade de combinar promoções;
- prioridade quando duas regras forem válidas;
- arredondamento;
- datas de vigência;
- aplicação automática ou aprovação manual;
- tratamento de vale, crédito e outras condições comerciais.

A tabela/engine definitivo de promoções deve refletir essa decisão, e não uma fórmula escolhida pelo desenvolvimento.

## 9. Integrações externas

**Fonte funcional:** VaxChat, VaxLab, GoPage, ShopVax, WhatsApp, gateways de pagamento e e-commerce.

**Já existe:** registro seguro de configuração por empresa, estados de integração, referência de segredo sem exposição pela API, auditoria e isolamento multiempresa.

**Falta para operação real de cada provedor:**
- documentação/API oficial;
- URL/base URL;
- método de autenticação;
- credenciais/referências de segredo;
- webhooks e eventos;
- mapeamento de IDs externos para entidades do ERP;
- política de retry/idempotência específica do contrato;
- ambiente de homologação/produção.

Uma integração não será marcada como conectada apenas por possuir configuração cadastrada.

## 10. Envio de rastreio por e-mail/WhatsApp

**Fonte funcional:** código de rastreio dos Correios com envio por e-mail/WhatsApp.

**Já existe:** registro do código de rastreio e estrutura logística da venda.

**Falta definir/conectar:**
- provedor de e-mail;
- integração WhatsApp operacional;
- remetente/número;
- template/conteúdo aprovado;
- gatilho de envio e regra de reenvio.

## 11. Conciliação bancária automática

**Fonte funcional:** conciliação bancária.

**Já existe:** conciliação manual funcional entre lançamentos bancários e recebimentos/pagamentos, com limites, direção crédito/débito, auditoria e isolamento.

**Se houver automação/importação**, falta definir:
- banco/provedor;
- formato de extrato/API;
- identificadores disponíveis;
- regra de matching;
- tolerância de valores/datas;
- tratamento de múltiplas correspondências.

## 12. Interface final / Stitch

**Fonte visual obrigatória:** Stitch aprovado.

**Já existe:** backend funcional e telas provisórias suficientes para desenvolvimento/validação técnica.

**Falta para fechamento visual:** referência detalhada/exportável das telas e do design system do Stitch para implementar e comparar:
- shell/sidebar;
- tipografia;
- cores/tokens;
- espaçamentos;
- cards;
- tabelas;
- filtros;
- campos;
- botões/ícones;
- modais/estados;
- responsividade;
- Dashboard Geral;
- Clientes & CRM;
- Produtos & Estoque;
- demais telas novas derivadas do mesmo design system.

## 13. Produção, domínio e comercialização

**Fonte funcional:** domínio próprio e preparação para acesso adicional de compra/assinatura quando comercializado.

**Já existe:** arquitetura multiempresa, isolamento, autenticação, permissões, configuração por empresa, backup/restore, gestão tenant-scoped de usuários e provisionamento técnico controlado de nova organização + primeiro `OWNER`. O provisionamento é transacional, auditado e possui teste de isolamento/autenticação.

**Continua faltando definir:**
- domínio final;
- DNS/TLS e VPS/ambiente de produção definitivo;
- modelo de contratação;
- planos/assinaturas;
- cobrança;
- gatilho comercial que chamará o provisionamento após compra/assinatura;
- suspensão/cancelamento e ciclo de vida da assinatura;
- política para vincular automaticamente usuários já existentes em contratações futuras.

O provisionamento técnico já existente não deve ser confundido com contratação automática. Enquanto planos, cobrança e ciclo de vida não forem aprovados, nenhuma rota pública de auto-cadastro/checkout será criada por suposição.

---

## Regra de fechamento

Quando uma decisão acima for aprovada, ela deve ser registrada no repositório antes ou junto da implementação correspondente. Alterações futuras devem preservar rastreabilidade e não modificar silenciosamente regras já aprovadas.
