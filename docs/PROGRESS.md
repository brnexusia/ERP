# Progresso — ERP Pedro

Estados permitidos:
- ⬜ Não iniciado
- 🟡 Em construção
- 🟠 Funcional
- 🔵 Em homologação
- ✅ Fechado

## Marcos

| # | Progresso | Estado |
|---|---|---|
| 1 | Fundação do sistema | ✅ Fechado |
| 2 | Design system + estrutura visual | 🟡 Em construção |
| 3 | Gestão de Clientes | 🟡 Em construção |
| 4 | Crédito, Vale e CRM | 🟡 Em construção |
| 5 | Produtos e estrutura de estoque | 🟡 Em construção |
| 6 | Estoque inteligente | 🟡 Em construção |
| 7 | Fluxo comercial | 🟡 Em construção |
| 8 | Pagamentos e entrega | 🟡 Em construção |
| 9 | Vendedoras, metas e comissões | 🟡 Em construção |
| 10 | Relatórios e dashboards | 🟡 Em construção |
| 11 | Financeiro | ⬜ Não iniciado |
| 12 | Promoções e catálogo | 🟡 Em construção |
| 13 | Integrações | ⬜ Não iniciado |
| 14 | Preparação como produto | ⬜ Não iniciado |
| 15 | Homologação final | ⬜ Não iniciado |

## Progresso 1 — Fundação do sistema ✅

- [x] Repositório oficial identificado e inicializado.
- [x] Arquitetura-base documentada.
- [x] Estratégia multiempresa definida.
- [x] Regra de isolamento de dados definida.
- [x] Aplicação Next.js/TypeScript criada.
- [x] PostgreSQL reproduzível configurado.
- [x] Prisma configurado.
- [x] Migration inicial versionada e aplicada em PostgreSQL real de CI.
- [x] Modelos base de empresa, usuário, membership, sessão, integração e auditoria.
- [x] Autenticação implementada com senha scrypt e sessão persistida.
- [x] Logout com invalidação da sessão.
- [x] Controle de tenant e troca segura de empresa implementados.
- [x] Matriz inicial de papéis e permissões implementada.
- [x] Helpers de acesso tenant-scoped criados.
- [x] Rota raiz protegida e tela provisória de login criada.
- [x] Seletor provisório de empresa conectado à autorização do servidor.
- [x] Seed do primeiro tenant/administrador executado em CI.
- [x] Teste real de isolamento A/B entre duas empresas.
- [x] Tentativa de troca para empresa sem membership bloqueada com 403.
- [x] Build e typecheck executados com sucesso.
- [x] Smoke test HTTP de login, navegação, troca de empresa e logout executado com sucesso.
- [x] Healthcheck do banco/aplicação criado.
- [x] Estrutura de produção, backup e recuperação documentada.
- [x] Scripts de backup e restore do PostgreSQL criados.

### Evidência de fechamento

O workflow `ERP CI` executa PostgreSQL real em container, migration versionada, seed, teste de isolamento multiempresa, matriz de permissões, typecheck, build e smoke test HTTP da aplicação. O run 20 (`35026877272`) terminou com todos os passos em sucesso.

## Progresso 2 — Design system + estrutura visual 🟡

Fonte obrigatória: Stitch aprovado. Devem ser reproduzidos fielmente estrutura de páginas/sidebar, cabeçalhos, cards, dashboards, tabelas, gráficos, cores, tipografia, espaçamentos, botões, ícones, campos, filtros, modais, estados e responsividade.

Telas explicitamente indicadas como já desenhadas no Stitch:
- Dashboard Geral;
- Clientes & CRM;
- Produtos & Estoque;
- design system do ERP.

Regra deste progresso: não converter telas provisórias em design definitivo por interpretação. Os valores visuais finais só entram a partir da referência correspondente do Stitch.

### Critério de fechamento do Progresso 2

O marco vira ✅ quando shell global, sidebar, cabeçalho e componentes compartilhados estiverem implementados e comparados com a fonte oficial do Stitch, incluindo estados e responsividade relevantes.

## Progresso 3 — Gestão de Clientes 🟡

- [x] Modelo `Client` isolado por empresa.
- [x] Endereço completo em entidade própria e isolada por empresa.
- [x] CPF/CNPJ normalizado, classificado e validado.
- [x] CPF/CNPJ único dentro de cada empresa e permitido entre empresas distintas.
- [x] WhatsApp normalizado.
- [x] E-mail validado.
- [x] Listagem, consulta, cadastro e atualização por tenant.
- [x] Segmento atual exposto nas consultas.
- [x] Vendedora responsável exposta nas consultas.
- [x] Histórico real de compras conectado às vendas pagas.
- [x] Perfil comercial central com compras e relacionamento.
- [x] Auditoria de criação e atualização.
- [x] Permissões `clients:read` e `clients:write` aplicadas.
- [x] API bloqueia acesso cruzado entre empresas.
- [x] Smoke test real da API em PostgreSQL.
- [ ] Tela de listagem conforme Stitch.
- [ ] Tela/formulário de cadastro conforme Stitch.
- [ ] Tela de detalhe/perfil conforme Stitch.

### Critério de fechamento do Progresso 3

Só vira ✅ quando cadastro, consulta, edição, endereço e histórico estiverem funcionais na interface fiel ao Stitch e mantiverem o isolamento multiempresa validado no backend.

## Progresso 4 — Crédito, Vale e CRM 🟡

- [x] Segmentos/grupos por empresa.
- [x] Linha de crédito com limite, utilizado, disponível e histórico.
- [x] Movimentação acima do limite bloqueada.
- [x] Limite não pode ficar abaixo do crédito utilizado.
- [x] Vale com saldo atual e histórico de movimentações.
- [x] Lançamentos de vale permitidos pelas permissões comerciais definidas.
- [x] Saldo de vale negativo bloqueado.
- [x] CRM com histórico de relacionamento, atividades, follow-up e conclusão.
- [x] Configuração de `X dias` de inatividade por empresa.
- [x] Alerta automático de inatividade conectado à data real da última compra paga.
- [x] Perfil comercial indica dias sem compra e estado de alerta.
- [x] Todas as estruturas são isoladas por empresa e auditadas.
- [x] Regras financeiras críticas também protegidas por constraints no PostgreSQL.
- [ ] Interface final de Crédito/Vale/CRM conforme Stitch.

O alerta de inatividade não fabrica histórico para clientes sem compra registrada. Ele usa exclusivamente compras efetivamente pagas no fluxo comercial.

## Progresso 5 — Produtos e estrutura de estoque 🟡

- [x] Cadastro de produto isolado por empresa.
- [x] Nome, SKU e código de barras.
- [x] Categoria e subcategoria em dois níveis.
- [x] Marca/fabricante.
- [x] Descrição detalhada.
- [x] Atributos técnicos estruturados.
- [x] Fotos de produto, inclusive identificadas por variação.
- [x] Preço de custo e preço de venda com precisão decimal.
- [x] Unidade de medida.
- [x] Consulta, listagem e atualização por API.
- [x] Estoque atual, mínimo e máximo por produto.
- [x] Validação de estoque máximo maior ou igual ao mínimo.
- [x] Quantidades e preços não negativos protegidos no PostgreSQL.
- [x] Auditoria e permissões `inventory:read` / `inventory:write`.
- [x] Isolamento multiempresa validado por smoke test.
- [ ] Interface de Produtos & Estoque conforme Stitch.

### Catálogo automático já conectado

O catálogo é construído diretamente a partir dos produtos cadastrados, sem duplicação. Existe token/link público e endpoint público de catálogo. O preço de custo não é exposto. A página visual pública permanece pendente até o design system do Stitch estar disponível.

## Progresso 6 — Estoque inteligente 🟡

- [x] Estoque mínimo e máximo por produto.
- [x] Produto em estoque baixo identificado automaticamente quando quantidade atual <= mínimo.
- [x] Endpoint dedicado de estoque baixo por empresa.
- [x] Categorias predominantes calculadas a partir das compras pagas de cada cliente.
- [ ] Identificação/alerta de produtos com baixa saída.
- [ ] Curva ABC por importância, faturamento e giro.

Baixa saída e Curva ABC permanecem sem classificação automática porque o documento não define janela, limiar nem faixas A/B/C. Os dados reais de vendas já existem para aplicar a regra assim que ela estiver definida, sem inventar critérios.

## Progresso 7 — Fluxo comercial 🟡

Base central da Etapa 2 implementada:

- [x] Diretório de vendedoras baseado nas memberships `SELLER` da empresa.
- [x] Cliente vinculado à vendedora responsável.
- [x] Orçamento criado com cliente, vendedora, canal, produtos, quantidades e valores.
- [x] Preço de venda do produto é congelado no item comercial no momento do orçamento.
- [x] Orçamento pode ser ajustado antes da confirmação.
- [x] Orçamento evolui para pedido sem criar novo cadastro.
- [x] Pedido evolui para pago no mesmo registro quando os pagamentos quitados atingem o total.
- [x] Identidade do cliente, vendedora e histórico permanece no mesmo registro durante o fluxo.
- [x] Canais suportados: WhatsApp, Site e Loja Física.
- [x] Histórico de compras do cliente utiliza somente vendas pagas.
- [x] Acesso entre empresas bloqueado por tenant.
- [x] Auditoria das transições comerciais.
- [ ] Interface comercial conforme Stitch.
- [ ] Classificação automática de “reduziu compras” depende da regra de comparação entre períodos, não especificada no documento.

### Evidência

O run 87 (`35034493876`) concluiu com migration, Prisma, isolamento, typecheck, build e smoke em sucesso. O teste comprova `orçamento -> pedido -> pagamento` mantendo o mesmo `sale.id`, além de vendedora, canal, itens, pagamentos, histórico de compra e bloqueio cross-tenant.

## Progresso 8 — Pagamentos e entrega 🟡

- [x] Cartão.
- [x] Pix.
- [x] Boleto.
- [x] Cheque.
- [x] Pagamento pendente e pagamento quitado diferenciados tecnicamente.
- [x] Data de vencimento disponível para boleto/cheque pré-datado.
- [x] Múltiplos registros de pagamento podem compor o valor do pedido sem ultrapassar o total.
- [x] Venda só muda para `PAID` quando o total quitado alcança o total do pedido.
- [x] Histórico de formas de pagamento disponível no perfil comercial do cliente.
- [ ] Retirada: registro da retirada.
- [ ] Correios: código de rastreio.
- [ ] Envio de rastreio por e-mail/WhatsApp.
- [ ] Transportadora: registro e comprovante de envio/entrega.

O envio externo de rastreio ficará ligado às integrações correspondentes; não foi simulado como se uma mensagem tivesse sido enviada.

## Progresso 9 — Vendedoras, metas e comissões 🟡

- [x] Vendedora responsável vinculada ao cliente.
- [x] Venda vinculada à vendedora durante todo o fluxo.
- [x] Relatório por vendedora com vendas, faturamento, clientes únicos e ticket médio.
- [ ] Definição e acompanhamento de metas.
- [ ] Página de comissões.
- [ ] Cálculo de comissão.
- [ ] Indicadores finais para treinamento/desenvolvimento.

O documento exige comissões, mas não define fórmula, percentual, base de cálculo ou momento de reconhecimento. Nenhuma regra financeira foi inventada.

## Progresso 10 — Relatórios e dashboards 🟡

Backend de indicadores comerciais já iniciado:

- [x] Vendas pagas por período.
- [x] Faturamento por período.
- [x] Ticket médio geral.
- [x] Ticket médio de clientes novos e antigos quando o período possui data inicial.
- [x] Vendas e faturamento por canal.
- [x] Performance por vendedora.
- [x] Quantidade de clientes únicos atendidos por vendedora.
- [x] Perfil do cliente com total comprado, quantidade de compras, primeira e última compra.
- [x] Cliente identificado como novo, recorrente ou sem compra registrada a partir do histórico efetivo.
- [x] Formas de pagamento utilizadas por cliente.
- [x] Categorias predominantes por cliente.
- [x] Filtro de período por data inicial/final na API comercial.
- [ ] Dashboard visual conforme Stitch.
- [ ] Metas no dashboard.
- [ ] Comissões no dashboard.
- [ ] Indicador de redução de compra após definição do critério de comparação.

### Evidência

O run 95 (`35034723144`) concluiu migrations, seed, isolamento, typecheck, build e todos os smoke tests em sucesso, incluindo perfil comercial, categoria predominante, histórico de pagamento, alerta de inatividade, faturamento, ticket médio, canal e performance por vendedora.

## Progresso 12 — Promoções e catálogo 🟡

- [x] Fonte de catálogo automático é o cadastro real de produtos.
- [x] Link/token público de catálogo sem duplicação de dados.
- [x] Histórico real de formas de pagamento já existe no fluxo comercial.
- [ ] Página visual pública conforme design system aprovado.
- [ ] Regras de descontos progressivos por quantidade, categoria ou volume.
- [ ] Exemplo operacional de preço diferenciado por dúzia fechada.
- [ ] Tabela de promoções e demais regras da Etapa 4.
- [ ] Regra de auto-atacado baseada em recompra dentro de até 3 meses.

## Regras de negócio ainda não definidas no documento-fonte

Para preservar o escopo sem criar comportamento silencioso, continuam aguardando definição objetiva:
- critério/janela para “reduziu compras”;
- limiar/janela para produto de baixa saída;
- faixas e pesos da Curva ABC;
- fórmula, percentual e base das comissões;
- métrica e unidade exata das metas por vendedora;
- gatilho exato da regra de auto-atacado além da referência a recompra em até 3 meses;
- momento exato em que uma venda deve baixar fisicamente o estoque.

Esses pontos não impedem os cadastros e dados-base já implementados, mas não serão preenchidos com suposições.
