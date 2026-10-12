# Júlia Bijoux — adequação controlada do ERP Pedro

Fonte: Requisitos do ERP — Júlia Bijoux (9 páginas, out/2026). O escopo oficial do ERP Pedro e a ordem de quatro módulos continuam vigentes.

## Entrega deste PR — Módulo 1

- Instagram opcional no cadastro e edição.
- Representante comercial cadastrado por gestor, vinculado ao cliente, isolado por empresa; percentual de referência apenas, sem cálculo automático de comissão.
- Tabela comercial de referência por cliente (LOJA, CATALOGO, NUVEMSHOP, ESPECIAL). **Não equivale a preços por canal calculados**: essa engine pertence à fase de preços/integrações e precisa de regra de margem/gestor aprovada.
- Inatividade configurável por cliente com fallback para X dias geral; sinal no painel para a vendedora que mais atendeu o cliente em compras pagas, ou responsável vinculado se não houver compra. **Não envia WhatsApp automático** sem credenciais e contrato técnico.
- Política de crédito do cliente (habilitado/desabilitado e modalidades CHEQUE, BOLETO, VALE), exclusiva do gestor. Limite de crédito também restrito a OWNER/ADMIN/MANAGER. **A trava em novas vendas a prazo pertence ao fluxo do Módulo 2**.
- Consulta assistida, acionada manualmente, de CEP (ViaCEP) e CNPJ (BrasilAPI) com timeouts e preenchimento conservador. Não substitui validação cadastral nem existe dependência obrigatória de API externa.
- Indicadores adicionais no perfil comercial: vendedora mais frequente, intervalo médio entre compras e produtos mais comprados.
- Proteção de custos: a API de catálogo de produtos não retorna `costPrice` para SELLER e demais papéis sem gestão, independentemente da UI.
- Migração aditiva e guard de tenant no banco. Sem modificação de vendas/estoque preexistentes.

## Módulo 2 — implementação parcial

Implementado neste PR: vínculo opcional do representante comercial com cada venda, percentual referencial congelado no orçamento, alteração do percentual por gestor (auditada); pagamentos por DINHEIRO (CASH) e VALE, datas de vencimento para VALE, e metadados opcionais de cheque (banco, número, titular, data planejada de depósito). Migração aditiva, com testes de venda e pagamento no CI.

**Não gera comissões automaticamente ainda**: falta ledger/fechamento auditável e aprovação de regras para cancelamento/estorno. **Não baixa estoque, não habilita venda por dúzia e não ativa a trava automática de crédito neste PR**.

## Módulo 2 — pendente, dependente de decisões

- Comissões de vendedoras por mês e representantes por parcela; fechamento auditável e cancelamento/estorno.
- Descontos por item/total, aprovação acima de limite, preços congelados e documentos/romaneios.
- Separação/conferência por outro funcionário, bloqueio de expedição sem conferência.
- Parcelamento de cheque, boleto, vale, dinheiro e cartão; devolução e débito avulso; política de restrição efetiva na venda.
- Representante opcional na venda e relatório gerencial por representante.

## Módulo 3 — pendente

- Famílias-modelos com herança configurável; foto e estoque por variação/cor.
- Venda por unidade e dúzia com composição de cores, conversões e controle em peças.
- Entradas por fornecedor/lote, inventário por código de barras, reservas, localizações e etiquetas.
- Giro, estoque alto/baixo, previsão, ações comerciais para encalhados e recomendações regionais.

## Módulo 4 — pendente

- Tabelas e margens/markup por canal, promoções, descontos especiais, publicação/catálogo.
- Nuvemshop bidirecional, WhatsApp individual por vendedora, GoPage quando houver API.
- Notificações financeiras, cobranças, caixa por meio de pagamento, relatórios regionais, exportações e automação contábil.

## Condições para a implementação plena

Não presumir margens padrão, taxas/comissões, limites de desconto, prioridade de regras, interpretação única do identificador fotografado `LL814003` (família x SKU x embalagem), composição fixa `8D+4P` para todos os produtos, capacidades de APIs externas nem integração fiscal. São configurações por empresa, não constantes globais.

Este PR não marca todos esses itens como feitos e não publica automaticamente a aplicação na VPS. Validar em branch/CI antes de qualquer deploy.
