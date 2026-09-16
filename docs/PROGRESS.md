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
| 11 | Financeiro | 🟡 Em construção |
| 12 | Promoções e catálogo | 🟡 Em construção |
| 13 | Integrações | 🟡 Em construção |
| 14 | Preparação como produto | 🟡 Em construção |
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
- [x] Perfil comercial com compras e relacionamento.
- [x] Perfil central do cliente reúne cadastro, dados comerciais, histórico de compras, crédito, vale, CRM e suporte no mesmo retorno.
- [x] Perfil central reutiliza as estruturas reais dos módulos, sem duplicar saldos ou histórico comercial.
- [x] Perfil central bloqueia consulta cruzada entre empresas.
- [x] Auditoria de criação e atualização.
- [x] Permissões `clients:read` e `clients:write` aplicadas.
- [x] API bloqueia acesso cruzado entre empresas.
- [x] Smoke test real da API em PostgreSQL.
- [ ] Tela de listagem conforme Stitch.
- [ ] Tela/formulário de cadastro conforme Stitch.
- [ ] Tela de detalhe/perfil conforme Stitch.

### Evidência

O run 166 (`35038451808`) concluiu migrations, seed, isolamento, typecheck, build e todos os smoke tests em sucesso. A suíte valida o perfil central reunindo cadastro, vendedora responsável, compras pagas, crédito/limite disponível, vale, CRM e atendimento, além de retornar 404 quando o mesmo ID é consultado a partir de outro tenant.

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
- [x] Base factual por produto com quantidade vendida, faturamento, quantidade de vendas pagas, última venda e posição atual de estoque.
- [x] Métricas de produto aceitam filtro por período e usam somente vendas efetivamente pagas.
- [ ] Identificação/alerta automático de produtos com baixa saída.
- [ ] Curva ABC classificada por importância, faturamento e giro.

Baixa saída e Curva ABC permanecem sem classificação automática porque o documento não define janela, limiar nem faixas A/B/C. A base factual necessária já existe; nenhuma classe ou alerta é inventado sem critério aprovado.

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
- [x] Atendimento registrado no histórico do cliente.
- [x] Pós-venda registrado no histórico do cliente.
- [x] Reclamações registradas no histórico do cliente.
- [x] SAC registrado no histórico do cliente.
- [x] Registro de suporte pode ser vinculado à venda correspondente sem duplicar o histórico comercial.
- [x] Retirada registrada com data/hora da retirada.
- [x] Correios com código de rastreio registrado.
- [x] Transportadora registrada por nome.
- [x] Comprovante de envio da transportadora suportado por URL.
- [x] Comprovante de entrega da transportadora suportado por URL.
- [x] Registro logístico só é permitido depois que o orçamento virou pedido.
- [x] Suporte e logística auditados e isolados por empresa.
- [ ] Envio do rastreio por e-mail.
- [ ] Envio do rastreio por WhatsApp.
- [ ] Interface de suporte/entrega conforme Stitch.

O envio externo do rastreio permanece pendente até as integrações correspondentes existirem. Nenhum envio foi marcado como realizado sem uma integração real.

### Evidência

O run 106 (`35035182736`) concluiu migrations, Prisma, isolamento, typecheck, build e todos os smoke tests em sucesso. O teste de suporte/logística valida as quatro categorias exigidas pelo escopo, vínculo opcional à venda, bloqueio de entrega em orçamento, retirada, Correios, transportadora, comprovantes, auditoria e isolamento cross-tenant.

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

Backend de indicadores e dashboard já iniciado:

- [x] Vendas pagas por período.
- [x] Faturamento por período.
- [x] Ticket médio geral.
- [x] Ticket médio de clientes novos e antigos quando o período possui data inicial.
- [x] Vendas e faturamento por canal.
- [x] Performance por vendedora.
- [x] Quantidade de clientes únicos atendidos por vendedora.
- [x] Perfil do cliente com total comprado, quantidade de compras, primeira e última compra.
- [x] Classificação factual de cliente sem compra, novo e recorrente a partir do histórico real.
- [x] Identificação de cliente que parou de comprar reaproveita o `X dias` configurado no módulo de clientes.
- [x] Quando `X dias` não está configurado, o sistema não fabrica classificação de cliente parado.
- [x] Ranking factual de clientes por valor comprado, com quantidade de compras, primeira e última compra.
- [x] Formas de pagamento utilizadas por cliente.
- [x] Categorias predominantes por cliente.
- [x] Filtro de período por data inicial/final na API comercial.
- [x] Endpoint de Dashboard Geral agrega dados comerciais, top compradores, inatividade, estoque baixo e financeiro a partir dos módulos reais.
- [x] Dashboard Geral respeita permissões: se o papel não possuir acesso financeiro, a seção financeira não é retornada.
- [x] Dashboard Geral permanece tenant-scoped e não mistura indicadores entre empresas.
- [ ] Dashboard visual conforme Stitch.
- [ ] Metas no dashboard.
- [ ] Comissões no dashboard.
- [ ] Indicador de redução de compra após definição do critério de comparação.

A classificação “reduziu compras” continua explicitamente pendente porque o documento não define período comparativo, métrica nem limiar. Ela não foi inferida a partir da regra de inatividade.

### Evidência

O run 170 (`35038674059`) concluiu migrations, seed, isolamento, typecheck, build e toda a suíte de smoke tests em sucesso. O teste do Dashboard Geral valida receita/canal, ranking de cliente, alerta de inatividade, estoque baixo, resumo financeiro, omissão do financeiro para papel sem permissão e isolamento entre dois tenants. O perfil central do cliente já havia sido validado pelo run 166 (`35038451808`).

## Progresso 11 — Financeiro 🟡

Base funcional da Etapa 4 implementada no servidor:

- [x] Contas a receber derivadas dos pagamentos reais vinculados às vendas, sem duplicar a origem comercial.
- [x] Situação pendente/recebida e vencimento disponíveis nas contas a receber.
- [x] Contas a pagar com descrição, valor, vencimento, situação e data efetiva de pagamento.
- [x] Baixa de conta a pagar auditada.
- [x] Fluxo de caixa realizado calcula entradas recebidas e saídas efetivamente pagas.
- [x] Fluxo de caixa aceita filtro por período.
- [x] Conciliação bancária com lançamento de crédito/débito e vínculo ao recebimento ou pagamento correspondente.
- [x] Conciliação aceita composição parcial e impede que o valor conciliado ultrapasse o lançamento bancário ou a origem financeira.
- [x] Crédito bancário só pode ser conciliado com recebimento; débito bancário só pode ser conciliado com conta paga.
- [x] Relatório financeiro consolida contas a receber pendentes/vencidas, contas a pagar pendentes/vencidas, entradas, saídas, saldo líquido e conciliações.
- [x] Permissões `finance:read` e `finance:write` aplicadas.
- [x] Regras críticas de valor/estado protegidas também por constraints no PostgreSQL.
- [x] Auditoria financeira e isolamento multiempresa validados.
- [ ] Interface financeira conforme o design system do Stitch.
- [ ] Importação/sincronização automática de extrato bancário depende da integração bancária que vier a ser definida; o documento exige conciliação, mas não especifica instituição, protocolo ou provedor.

As contas a receber usam os registros reais de pagamento do fluxo comercial como fonte, evitando uma segunda verdade financeira. A conciliação implementada é funcional e manual; nenhum mecanismo de matching automático ou integração bancária foi presumido porque isso não está definido no documento-fonte.

### Evidência

O run 121 (`35035950290`) concluiu migration financeira, validação do Prisma, seed, isolamento multiempresa, typecheck, build e todos os smoke tests em sucesso. O smoke financeiro valida conta a receber real, criação/baixa de conta a pagar, fluxo de caixa, conciliação de crédito e débito, bloqueio de conciliação incompatível, relatório consolidado, auditoria e isolamento cross-tenant.

## Progresso 12 — Promoções e catálogo 🟡

- [x] Fonte de catálogo automático é o cadastro real de produtos.
- [x] Link/token público de catálogo sem duplicação de dados.
- [x] Histórico real de formas de pagamento já existe no fluxo comercial.
- [ ] Página visual pública conforme design system aprovado.
- [ ] Regras de descontos progressivos por quantidade, categoria ou volume.
- [ ] Exemplo operacional de preço diferenciado por dúzia fechada.
- [ ] Tabela de promoções e demais regras da Etapa 4.
- [ ] Regra de auto-atacado baseada em recompra dentro de até 3 meses.

## Progresso 13 — Integrações 🟡

A camada de configuração multiempresa das integrações previstas no escopo foi criada sem simular conectividade externa que ainda não possui contrato técnico fornecido:

- [x] Registro tenant-scoped para VaxChat.
- [x] Registro tenant-scoped para VaxLab.
- [x] Registro tenant-scoped para GoPage.
- [x] Registro tenant-scoped para ShopVax.
- [x] Registro tenant-scoped para WhatsApp.
- [x] Registro tenant-scoped para gateway de pagamento.
- [x] Registro tenant-scoped para e-commerce.
- [x] Chave de integração única por `empresa + provider + key`, permitindo configurações independentes entre clientes do ERP.
- [x] Configuração pode ser habilitada/desabilitada sem ser marcada artificialmente como conectada.
- [x] Referência de segredo é mantida no servidor e não é retornada pela API; a resposta pública informa apenas se existe segredo configurado.
- [x] Criação/alteração auditada.
- [x] Isolamento de configurações entre empresas validado por teste.
- [ ] Integração operacional com GoPage.
- [ ] Integração operacional com ShopVax.
- [ ] Vínculo operacional completo com WhatsApp.
- [ ] Integração operacional com gateway(s) de pagamento.
- [ ] Integração operacional com e-commerce.
- [ ] VaxChat/VaxLab operacionais no ERP.

As chamadas reais, webhooks e sincronizações permanecem pendentes até existirem especificações técnicas, URLs, autenticação/credenciais e contratos de eventos de cada provedor. O ERP não considera uma integração conectada apenas porque sua configuração foi cadastrada.

### Evidência

O run 129 (`35036425320`) concluiu Prisma, todas as migrations, seed, isolamento, typecheck, build e todos os smoke tests em sucesso. O smoke de integrações valida os sete tipos previstos, não exposição de `secretRef`, upsert sem duplicação, desativação e isolamento multiempresa.

## Progresso 14 — Preparação como produto 🟡

A arquitetura já incorpora parte da preparação comercial prevista no documento-fonte:

- [x] Estrutura multiempresa/multicliente desde a fundação.
- [x] Isolamento de dados por empresa validado em PostgreSQL e smoke tests.
- [x] Usuários e permissões vinculados à empresa.
- [x] Gestão tenant-scoped de usuários: listar, criar/vincular, alterar papel e remover acesso.
- [x] Proteção do último `OWNER`, bloqueio de auto-rebaixamento/auto-remoção e revogação de sessão ao remover acesso.
- [x] Alterações de acesso auditadas e memberships de outras empresas invisíveis pela API.
- [x] Clientes separados por empresa.
- [x] Produtos e estoque separados por empresa.
- [x] Vendas e histórico comercial separados por empresa.
- [x] Financeiro separado por empresa.
- [x] Configurações de integrações separadas por empresa.
- [x] Troca de contexto de empresa exige membership válida.
- [x] Provisionamento técnico controlado cria nova empresa, primeiro usuário `OWNER`, membership e auditoria de forma transacional.
- [x] Empresa provisionada pode autenticar e operar isoladamente sem reutilizar o tenant original.
- [x] Comando interno `pnpm db:provision` documentado para provisionamento controlado.
- [x] Estrutura de container de produção preparada com aplicação e PostgreSQL persistente em rede interna.
- [x] Aplicação de produção preparada para executar migrations versionadas antes da inicialização.
- [x] Porta do PostgreSQL não é publicada pela stack de produção; aplicação fica em loopback para uso atrás de proxy/TLS.
- [x] Template de variáveis de produção e procedimento controlado de VPS documentados sem inserir segredos reais no repositório.
- [ ] VPS real configurada e homologada.
- [ ] Provisionamento acionado automaticamente por compra/assinatura.
- [ ] Fluxo de contratação/assinatura.
- [ ] Domínio próprio de produção configurado.
- [ ] DNS/TLS final configurado.
- [ ] Acesso adicional de compra/assinatura quando comercializado.

O provisionamento técnico já existe, mas não é tratado como assinatura automática. Da mesma forma, a stack de produção está preparada no repositório, mas não equivale a uma VPS já implantada. Planos, cobrança, gatilho comercial, suspensão/cancelamento, provedor da VPS e domínio final continuam dependendo de definição própria.

### Evidência

O run 153 (`35037627507`) validou gestão tenant-scoped de usuários e provisionamento técnico de novas empresas. A configuração de produção está versionada em `Dockerfile`, `docker-compose.production.yml`, `.env.production.example` e `docs/PRODUCTION_DEPLOYMENT.md`; sua validação de Compose também foi adicionada ao pipeline de CI e deve permanecer obrigatória antes de homologação de produção.

## Regras de negócio ainda não definidas no documento-fonte

Para preservar o escopo sem criar comportamento silencioso, continuam aguardando definição objetiva:
- critério/janela para “reduziu compras”;
- limiar/janela para produto de baixa saída;
- faixas e pesos da Curva ABC;
- fórmula, percentual e base das comissões;
- métrica e unidade exata das metas por vendedora;
- gatilho exato da regra de auto-atacado além da referência a recompra em até 3 meses;
- momento exato em que uma venda deve baixar fisicamente o estoque;
- fórmula/prioridade/vigência das promoções e descontos progressivos.

Esses pontos não impedem os cadastros e dados-base já implementados, mas não serão preenchidos com suposições.
