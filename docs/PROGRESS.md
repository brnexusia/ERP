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
| 7 | Fluxo comercial | ⬜ Não iniciado |
| 8 | Pagamentos e entrega | ⬜ Não iniciado |
| 9 | Vendedoras, metas e comissões | ⬜ Não iniciado |
| 10 | Relatórios e dashboards | ⬜ Não iniciado |
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

Fonte obrigatória: Stitch aprovado. O documento oficial disponível confirma que devem ser reproduzidos fielmente estrutura de páginas/sidebar, cabeçalhos, cards, dashboards, tabelas, gráficos, cores, tipografia, espaçamentos, botões, ícones, campos, filtros, modais, estados e responsividade.

Telas explicitamente indicadas como já desenhadas no Stitch:
- Dashboard Geral;
- Clientes & CRM;
- Produtos & Estoque;
- design system do ERP.

Regra deste progresso: não converter a tela provisória atual em design definitivo a partir de interpretação. Os valores visuais finais só entram a partir de referência suficientemente detalhada do Stitch.

### Critério de fechamento do Progresso 2

O marco vira ✅ quando shell global, sidebar, cabeçalho e componentes compartilhados estiverem implementados e comparados com a fonte oficial do Stitch, incluindo estados e responsividade relevantes.

## Progresso 3 — Gestão de Clientes 🟡

Base funcional implementada sem inventar o visual definitivo:

- [x] Modelo `Client` isolado por empresa.
- [x] Endereço completo em entidade própria e isolada por empresa.
- [x] CPF/CNPJ normalizado, classificado e validado.
- [x] CPF/CNPJ único dentro de cada empresa e permitido entre empresas distintas.
- [x] WhatsApp normalizado.
- [x] E-mail validado.
- [x] Listagem de clientes por tenant.
- [x] Consulta individual por tenant.
- [x] Cadastro de cliente.
- [x] Atualização de cliente e endereço.
- [x] Segmento atual exposto nas consultas de cliente.
- [x] Auditoria de criação e atualização.
- [x] Permissões `clients:read` e `clients:write` aplicadas.
- [x] API bloqueia acesso cruzado entre empresas.
- [x] Migration de clientes aplicada com sucesso.
- [x] Smoke test real da API passou em PostgreSQL: criar, consultar, atualizar, listar, bloquear duplicidade interna e bloquear acesso cross-tenant.
- [ ] Tela de listagem conforme Stitch.
- [ ] Tela/formulário de cadastro conforme Stitch.
- [ ] Tela de detalhe/edição conforme Stitch.
- [ ] Histórico de compras conectado ao fluxo comercial quando o Progresso 7 existir.

### Evidência atual

O run 31 (`35027529904`) concluiu com sucesso migration, seed, isolamento, typecheck, build e smoke test HTTP incluindo as operações de clientes.

### Critério de fechamento do Progresso 3

Só vira ✅ quando cadastro, consulta, edição, endereço e histórico de compras estiverem funcionais na interface fiel ao Stitch e mantiverem o isolamento multiempresa já validado no backend.

## Progresso 4 — Crédito, Vale e CRM 🟡

Base funcional implementada a partir do escopo oficial da Etapa 1:

- [x] Segmentos/grupos são cadastrados por empresa.
- [x] Cliente pode ser classificado em segmento/grupo da própria empresa.
- [x] Linha de crédito por cliente com limite registrado.
- [x] Valor utilizado mantido com precisão decimal.
- [x] Valor disponível calculado como limite menos utilizado.
- [x] Histórico de utilização de crédito com saldo anterior, saldo posterior, observação, usuário e data.
- [x] Movimentação que ultrapassa o limite é bloqueada.
- [x] Limite não pode ser reduzido abaixo do crédito já utilizado.
- [x] Vale por cliente com saldo atual.
- [x] Histórico de movimentações de vale com saldo anterior, saldo posterior, observação, usuário e data.
- [x] Lançamentos de vale permitidos para perfis com escrita de clientes, incluindo vendedoras.
- [x] Saldo de vale negativo é bloqueado.
- [x] CRM com histórico de relacionamento, registro de atividade, conteúdo, data da ocorrência e acompanhamento futuro.
- [x] Atividade de CRM pode receber data de follow-up e data de conclusão.
- [x] Configuração de `X dias` de inatividade por empresa criada.
- [x] Todas as estruturas são isoladas por empresa e auditadas.
- [x] Regras financeiras críticas também protegidas por constraints no PostgreSQL.
- [x] Migration, Prisma schema, typecheck e build validados.
- [x] Smoke test HTTP real validou segmento, crédito, vale, CRM e configuração de inatividade.
- [ ] Alerta automático de inatividade ligado ao histórico real de compras.
- [ ] Interface final de Crédito/Vale/CRM conforme Stitch.

### Dependência controlada do alerta de inatividade

O documento exige alerta automático após X dias sem compra. O valor X já está configurável. A geração do alerta não será simulada com datas artificiais: ela será conectada ao histórico real de pedidos/compras quando o Progresso 7 implementar o fluxo comercial. Assim a informação de inatividade terá uma única fonte real e não haverá duplicação silenciosa de histórico.

### Evidência atual

O run 51 (`35028235609`) concluiu em sucesso com migrations, seed, isolamento multiempresa, typecheck, build e smoke tests HTTP de autenticação, clientes, segmentação, crédito, vale, CRM e configuração de inatividade.

### Critério de fechamento do Progresso 4

Só vira ✅ quando as interfaces correspondentes estiverem fiéis ao Stitch e o alerta de inatividade estiver consumindo o histórico real de compras do fluxo comercial.

## Progresso 5 — Produtos e estrutura de estoque 🟡

Base funcional da Etapa 3 implementada no servidor:

- [x] Cadastro de produto isolado por empresa.
- [x] Nome.
- [x] SKU único dentro da empresa.
- [x] Código de barras, também protegido contra duplicidade dentro da empresa.
- [x] Categoria e subcategoria em dois níveis.
- [x] Marca/fabricante.
- [x] Descrição detalhada.
- [x] Atributos técnicos estruturados.
- [x] Fotos de produto.
- [x] Foto pode ser identificada por variação.
- [x] Preço de custo com precisão decimal.
- [x] Preço de venda com precisão decimal.
- [x] Unidade de medida.
- [x] Consulta, listagem e atualização de produtos por API.
- [x] Estoque atual, mínimo e máximo por produto.
- [x] Validação de estoque máximo maior ou igual ao mínimo.
- [x] Quantidades e preços não negativos protegidos no PostgreSQL.
- [x] Auditoria de cadastro, atualização e estoque.
- [x] Permissões `inventory:read` e `inventory:write` aplicadas.
- [x] Isolamento multiempresa de produtos validado por smoke test.
- [ ] Interface de Produtos & Estoque conforme Stitch.

### Catálogo automático já conectado

O catálogo é construído diretamente a partir dos produtos cadastrados, sem cadastro duplicado. Já existe token público compartilhável e endpoint público que retorna dados de catálogo. O preço de custo é deliberadamente excluído da saída pública. A página visual de catálogo compartilhável permanece pendente até o design system estar disponível, para não criar uma interface que conflite com a diretriz visual obrigatória.

### Evidência atual

O run 70 (`35033845833`) terminou com migrations, validação do Prisma, isolamento, typecheck, build e smoke tests em sucesso. O smoke de produtos valida categoria/subcategoria, cadastro completo, fotos e variação, SKU único, estoque baixo, atualização de quantidade, catálogo público e isolamento entre empresas.

### Critério de fechamento do Progresso 5

Só vira ✅ quando a interface Produtos & Estoque estiver fiel ao Stitch e o fluxo de mídia/fotos tiver a experiência final de servidor definida na interface aprovada.

## Progresso 6 — Estoque inteligente 🟡

- [x] Estoque mínimo e máximo definidos por produto.
- [x] Produto em estoque baixo é identificado automaticamente quando a quantidade atual atinge ou fica abaixo do mínimo.
- [x] Endpoint dedicado lista produtos em estoque baixo por empresa.
- [ ] Identificação de produtos com baixa saída.
- [ ] Curva ABC por importância, faturamento e giro.
- [ ] Análise de categorias predominantes no histórico de compra de cada cliente.

### Dependência controlada de vendas

Baixa saída, Curva ABC e análise por categoria exigem dados reais de vendas, faturamento, quantidade e histórico de compra. Esses indicadores não serão simulados. Serão calculados sobre o fluxo comercial central quando o Progresso 7 registrar pedidos e itens vendidos.

## Progresso 12 — Promoções e catálogo 🟡

- [x] Fonte de catálogo automático é o cadastro real de produtos.
- [x] Link/token público de catálogo criado sem duplicação de dados.
- [ ] Página visual pública conforme design system aprovado.
- [ ] Regras de descontos progressivos por quantidade, categoria ou volume.
- [ ] Exemplo operacional de preço diferenciado por dúzia fechada.
- [ ] Tabela de promoções e demais regras da Etapa 4.

As regras de auto-atacado, baseadas em recompra dentro de até 3 meses, e o histórico de formas de pagamento serão conectados aos registros reais do fluxo comercial. Não serão preenchidos artificialmente antes desse histórico existir.
