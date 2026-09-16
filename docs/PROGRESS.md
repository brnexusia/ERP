# Progresso — ERP Pedro

Estados permitidos:
- ⬜ Não iniciado
- 🟡 Em construção
- 🟠 Funcional
- 🔵 Em homologação
- ✅ Fechado

**Regra:** 🟠 significa que a base funcional correspondente já opera e possui testes, mas ainda pode depender de interface Stitch ou de complementos externos. ✅ só é usado quando funcionalidade, dados, segurança, testes e visual aplicável estiverem efetivamente fechados.

## Marcos

| # | Progresso | Estado |
|---|---|---|
| 1 | Fundação do sistema | ✅ Fechado |
| 2 | Design system + estrutura visual | 🟡 Em construção |
| 3 | Gestão de Clientes | 🟠 Funcional |
| 4 | Crédito, Vale e CRM | 🟠 Funcional |
| 5 | Produtos e estrutura de estoque | 🟠 Funcional |
| 6 | Estoque inteligente | 🟡 Em construção |
| 7 | Fluxo comercial | 🟠 Funcional |
| 8 | Pagamentos e entrega | 🟠 Funcional |
| 9 | Vendedoras, metas e comissões | 🟡 Em construção |
| 10 | Relatórios e dashboards | 🟡 Em construção |
| 11 | Financeiro | 🟠 Funcional |
| 12 | Promoções e catálogo | 🟡 Em construção |
| 13 | Integrações | 🟡 Em construção |
| 14 | Preparação como produto | 🟡 Em construção |
| 15 | Homologação final | ⬜ Não iniciado |

## Progresso 1 — Fundação do sistema ✅

Fechado e continuamente validado:
- Next.js + TypeScript + PostgreSQL + Prisma;
- migrations versionadas;
- autenticação com senha e sessão persistida;
- logout e invalidação de sessão;
- `Organization`, `User` e `Membership`;
- multiempresa e troca segura de tenant;
- RBAC no servidor;
- isolamento A/B entre empresas em PostgreSQL e smoke tests;
- auditoria de ações relevantes;
- consulta administrativa de auditoria tenant-scoped;
- healthcheck de banco e armazenamento persistente;
- scripts de backup/restore do PostgreSQL;
- build/typecheck/CI reproduzíveis;
- cabeçalhos HTTP básicos de endurecimento;
- mutações `/api` bloqueiam origem cross-site explícita e `Origin` divergente da origem da aplicação.

O fechamento da fundação não implica fechamento visual. A interface definitiva continua subordinada ao Stitch.

## Progresso 2 — Design system + estrutura visual 🟡

O Stitch aprovado é a fonte visual obrigatória. Devem ser reproduzidos fielmente:
- shell/sidebar e navegação;
- cabeçalhos, cards e dashboards;
- tabelas, gráficos, filtros e formulários;
- botões, ícones, modais e estados;
- tipografia, cores, espaçamentos e hierarquia;
- responsividade.

Telas explicitamente indicadas como já desenhadas no Stitch: Dashboard Geral, Clientes & CRM, Produtos & Estoque e o design system do ERP.

**Bloqueio atual:** a referência disponível no PDF não contém detalhe suficiente para declarar fidelidade pixel/estado/responsividade. Nenhum visual provisório será marcado como final por interpretação.

## Progresso 3 — Gestão de Clientes 🟠

Funcional no backend:
- cadastro/consulta/edição tenant-scoped;
- nome/razão, CPF/CNPJ, endereço completo, WhatsApp e e-mail;
- validação e normalização de documento/contatos;
- segmento e vendedora responsável;
- histórico real de compras pagas;
- perfil comercial;
- perfil central reunindo cadastro, compras, crédito, vale, CRM e suporte;
- auditoria e permissões;
- bloqueio cross-tenant.

**Pendente para ✅:** listagem, formulário e perfil visual conforme Stitch.

## Progresso 4 — Crédito, Vale e CRM 🟠

Funcional no backend:
- grupos/segmentos por empresa;
- linha de crédito com limite, utilizado, disponível e movimentos;
- bloqueio de uso acima do limite;
- vale com saldo e movimentos;
- bloqueio de saldo inválido;
- CRM com histórico, atividades, follow-up e conclusão;
- `X dias` de inatividade configurável por empresa;
- alerta baseado exclusivamente na última compra efetivamente paga;
- constraints críticas no PostgreSQL;
- auditoria e isolamento multiempresa.

**Pendente para ✅:** interface final Crédito/Vale/CRM conforme Stitch.

## Progresso 5 — Produtos e estrutura de estoque 🟠

Funcional no backend:
- nome, SKU, código de barras;
- categoria/subcategoria em dois níveis;
- marca/fabricante, descrição e atributos técnicos;
- fotos com variação;
- custo, preço e unidade de medida;
- estoque atual, mínimo e máximo;
- validações e constraints de valores/quantidades;
- API tenant-scoped e auditoria;
- armazenamento real de imagens de produto;
- imagem de catálogo pode ser explicitamente pública;
- token de arquivo assinado e validação de assinatura do conteúdo conhecido;
- catálogo automático lê o cadastro real, sem segunda base.

**Pendente para ✅:** Produtos & Estoque conforme Stitch.

## Progresso 6 — Estoque inteligente 🟡

Já implementado:
- mínimo/máximo;
- alerta factual de estoque baixo quando quantidade <= mínimo;
- métricas por produto: quantidade vendida, faturamento, vendas pagas, última venda e estoque;
- filtro por período;
- categorias predominantes por cliente.

Aguardando regra objetiva do negócio:
- produto de baixa saída: janela/limiar;
- Curva ABC: faixas/pesos/período;
- momento da baixa física e eventual reserva de estoque.

Nenhuma dessas regras será presumida.

## Progresso 7 — Fluxo comercial 🟠

Fluxo central funcional:

`Cliente → Orçamento → Pedido → Pagamento`

- cliente, vendedora, canal, produtos, quantidade e valores;
- preço congelado no item comercial;
- orçamento editável antes da confirmação;
- orçamento vira pedido no mesmo registro;
- pedido vira pago no mesmo `sale.id` quando o total quitado alcança o total;
- timeline unificada preserva transições, pagamentos, suporte e entrega no mesmo histórico comercial;
- canais WhatsApp, Site e Loja Física;
- histórico de compras usa somente vendas pagas;
- auditoria e isolamento multiempresa.

**Pendente para ✅:** interface comercial fiel ao Stitch e decisão formal sobre baixa física do estoque.

## Progresso 8 — Pagamentos e entrega 🟠

Funcional no backend:
- cartão, Pix, boleto, cheque e dinheiro;
- pagamento pendente/quitado;
- cartão, Pix e dinheiro não aceitam vencimento;
- boleto e cheque aceitam vencimento opcional, representando a condição à vista/pré-datada prevista no documento-fonte;
- API rejeita vencimento indevido em Pix/cartão/dinheiro;
- pagamentos parciais sem ultrapassar o total;
- atendimento, pós-venda, reclamações e SAC;
- retirada;
- Correios + código de rastreio;
- transportadora;
- upload de comprovantes de envio/entrega diretamente no ERP;
- armazenamento privado de comprovantes;
- arquivo privado exige autenticação, tenant correto e permissão adequada;
- comprovante de entrega não pode ser publicado anonimamente;
- suporte/logística auditados e isolados por empresa.

Ainda pendente para ✅:
- envio real do rastreio por e-mail;
- envio real do rastreio por WhatsApp;
- provedores/templates/gatilhos correspondentes;
- interface conforme Stitch.

## Progresso 9 — Vendedoras, metas e comissões 🟡

Já implementado:
- cliente vinculado à vendedora responsável;
- venda mantém a vendedora durante o fluxo;
- perfil factual da vendedora;
- carteira de clientes atribuídos;
- vendas pagas, faturamento, clientes únicos e ticket médio;
- desempenho por canal;
- filtro por período;
- isolamento multiempresa.

O endpoint de perfil retorna metas e comissões explicitamente como `PENDING_RULE_DEFINITION` enquanto não houver regra aprovada.

Ainda depende de definição:
- métrica/periodicidade da meta;
- fórmula e base das comissões;
- momento de reconhecimento e tratamento de estornos/devoluções;
- indicadores finais de treinamento/desenvolvimento;
- interface final.

## Progresso 10 — Relatórios e dashboards 🟡

Já implementado:
- vendas e faturamento por período;
- ticket médio geral, novos e antigos;
- canais;
- performance por vendedora;
- ranking factual de compradores;
- cliente sem compra/novo/recorrente;
- cliente que parou de comprar conforme `X dias` configurado;
- formas de pagamento e categorias predominantes por cliente;
- métricas factuais de produto;
- Dashboard Geral agregado com comercial, clientes, inatividade, estoque baixo e financeiro;
- dashboard respeita permissões e tenant.

Ainda pendente:
- Dashboard visual conforme Stitch;
- metas e comissões no dashboard após definição das regras;
- “reduziu compras” após definição de período/métrica/limiar.

## Progresso 11 — Financeiro 🟠

Funcional no backend:
- contas a receber derivadas dos pagamentos reais da venda;
- pendência, recebimento e vencimento;
- contas a pagar e baixa;
- fluxo de caixa realizado;
- conciliação bancária manual com crédito/débito e vínculo à origem;
- composição parcial com limites;
- relatório financeiro consolidado;
- permissões, auditoria, constraints e isolamento multiempresa.

**Pendente para ✅:** interface financeira conforme Stitch. Automação/importação bancária só será criada se houver provedor/contrato técnico definido.

## Progresso 12 — Promoções e catálogo 🟡

Já implementado:
- catálogo automático a partir de `Product`;
- token/link público;
- imagem pública de produto armazenável pelo próprio ERP;
- custo não exposto no catálogo;
- histórico de formas de pagamento disponível.

Ainda depende de regra aprovada:
- descontos progressivos;
- preço por dúzia fechada;
- promoções por produto/categoria/valor/quantidade;
- empilhamento/prioridade/vigência/arredondamento;
- auto-atacado.

Também falta a página visual pública conforme design system aprovado.

## Progresso 13 — Integrações 🟡

Camada de configuração tenant-scoped pronta para:
- VaxChat;
- VaxLab;
- GoPage;
- ShopVax;
- WhatsApp;
- gateway de pagamento;
- e-commerce.

Existe habilitação/desabilitação, referência de segredo sem exposição pela API, auditoria e isolamento.

As integrações **não são marcadas como conectadas** apenas por possuírem configuração. Chamadas reais, webhooks e sincronizações aguardam documentação/API, URLs, autenticação, credenciais e contrato de eventos de cada provedor. Webhooks futuros devem possuir autenticação/assinatura própria e exceção explícita, nunca desativar silenciosamente a proteção cross-site global.

## Progresso 14 — Preparação como produto 🟡

Já implementado:
- multiempresa/multicliente;
- isolamento de clientes, produtos, estoque, vendas, financeiro, integrações e arquivos;
- gestão tenant-scoped de usuários;
- proteção do último `OWNER` e revogação de sessão ao remover acesso;
- provisionamento transacional de nova empresa + primeiro `OWNER`;
- comando `pnpm db:provision`;
- Dockerfile e stack Compose de produção;
- PostgreSQL persistente e não exposto publicamente;
- aplicação em loopback preparada para proxy/TLS;
- volume persistente `file_storage`;
- upload público/privado por finalidade;
- tokens HMAC de arquivo via `FILE_TOKEN_SECRET`;
- tipos executáveis não previstos bloqueados;
- validação de assinatura para PNG/JPEG/GIF/WebP/PDF;
- consulta de auditoria administrativa por tenant;
- backup/restore de PostgreSQL com checksum;
- backup/restore do volume de arquivos com checksum;
- round-trip de recuperação real de banco e arquivos validado no CI;
- restore destrutivo protegido por confirmação explícita;
- validação de scripts operacionais e Compose no CI;
- healthcheck de PostgreSQL por TCP + armazenamento.

Ainda pendente:
- VPS real e homologada;
- domínio/DNS/TLS definitivos;
- conta/e-mail empresarial;
- política final de backup offsite/retention;
- planos, cobrança, contratação e ciclo de vida de assinatura;
- provisionamento acionado automaticamente por contratação.

## Progresso 15 — Homologação final ⬜

Só começa quando as dependências necessárias para o produto final estiverem resolvidas. A homologação deve cobrir:
- fluxos end-to-end;
- permissões;
- isolamento multiempresa;
- consistência de dados;
- arquivos e recuperação;
- erros/duplicidades;
- segurança;
- performance;
- responsividade;
- comparação tela a tela com o Stitch;
- integrações externas efetivamente ativadas.

## Evidências recentes de validação

- Run 166 (`35038451808`): perfil central do cliente e isolamento.
- Run 170 (`35038674059`): Dashboard Geral agregado e permission-aware.
- Run 176 (`35038885199`): configuração de produção/Compose validada.
- Run 213 (`35041806933`): perfil factual da vendedora + suíte completa verde.
- Run 216 (`35041950612`): segurança de leitura de arquivos privados + suíte completa verde.
- Run 233 (`35042735654`): comprovantes privados de transportadora + suíte completa verde.
- Run 237 (`35048022891`): proteção cross-site e regra à vista/pré-datada de pagamento + migrations, isolamento, typecheck, build, Compose e smoke tests verdes.
- Run 258 (`35049646523`): migrations, isolamento, build, Compose, restore real do PostgreSQL, restore real do volume de arquivos e suíte de smoke tests verdes.

A matriz detalhada requisito oficial → implementação → progresso está em `docs/SCOPE_TRACEABILITY.md`.

## Regras ainda não definidas pelo documento-fonte

Permanecem sem implementação automática final até aprovação objetiva:
- “reduziu compras”;
- baixa saída;
- Curva ABC;
- comissões;
- metas;
- auto-atacado;
- baixa/reserva de estoque;
- promoções/descontos progressivos;
- integrações externas reais onde o contrato técnico ainda não foi fornecido.

O desenvolvimento continua avançando sobre os dados-base e infraestrutura sem transformar essas lacunas em suposições.
