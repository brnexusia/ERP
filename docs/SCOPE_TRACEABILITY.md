# Rastreabilidade do escopo oficial — ERP Pedro

Este documento conecta o escopo funcional oficial aos progressos e implementações do repositório. Ele não substitui o documento-fonte nem o Stitch.

## Hierarquia de autoridade

1. Documento-fonte oficial: define **o que** o ERP precisa fazer.
2. Stitch aprovado: define **como a interface deve parecer e se comportar visualmente**.
3. Arquitetura e código: definem **como** o escopo é implementado tecnicamente.

Quando o documento exige uma função mas não fornece fórmula, limiar, prioridade ou integração técnica, a base pode ser preparada, porém a regra final permanece em `docs/DECISIONS_REQUIRED.md`.

## Etapa 1 — Gestão de Clientes

| Requisito oficial | Implementação atual | Progresso |
|---|---|---|
| Cadastro completo do cliente | `Client`, endereço, CPF/CNPJ, WhatsApp, e-mail, APIs + operação em `/clients` | 3 |
| Histórico de compras | Perfil comercial/central baseado somente em vendas pagas | 3 |
| Linha de crédito | Limite, utilizado, disponível e movimentos tenant-scoped + operação no perfil central | 4 |
| Vale do cliente | Saldo e movimentos tenant-scoped + operação no perfil central | 4 |
| Segmentação por grupo/perfil | `ClientSegment` por empresa + atribuição no perfil e gestão em `/clients/settings` | 4 |
| Aviso por X dias sem compra | Configuração por empresa + cálculo pela última compra paga + alertas em `/clients` | 4/10 |
| CRM integrado | Atividades, histórico, follow-up e conclusão + timeline operacional no perfil do cliente | 4 |
| Gestão central do cliente | `/api/clients/:id/central-profile` agrega cadastro, comercial, crédito, vale, CRM, suporte e histórico de pagamentos; `/clients` expõe o perfil operacional | 3/4/8 |
| Login e senha | Sessão persistida + autenticação + troca autenticada de senha com verificação da senha atual, revogação das sessões paralelas e auditoria | 1 |
| Controle de acesso | Membership + RBAC + autorização no servidor | 1/14 |
| VaxChat | Configuração preparada; operação real depende de contrato técnico | 13 |
| VaxLab | Configuração preparada; operação real depende de contrato técnico | 13 |


### Gate atual da Etapa 1

A camada funcional e a interface operacional da Etapa 1 estão em homologação. O gate automatizado é `pnpm test:module-1`. O status final não é marcado como fechado enquanto faltarem (a) comparação fiel com a fonte completa do Stitch e (b) chamadas/sincronizações reais de VaxChat e VaxLab com contrato técnico e credenciais válidas.

## Etapa 2 — Vendas, Relatórios e Comissões

| Requisito oficial | Implementação atual | Progresso |
|---|---|---|
| Maiores compradores | Ranking factual por valor pago | 10 |
| Clientes novos/recorrentes | Classificação a partir do histórico pago | 10 |
| Clientes que pararam de comprar | Usa o X dias configurado | 10 |
| Clientes que reduziram compras | Comparação factual tenant-scoped por dois períodos explícitos e métrica `REVENUE`/`PURCHASES`; regra automática/padrão continua pendente | 10 |
| Direcionamento para vendedora | Cliente possui vendedora responsável | 7/9 |
| Perfil da vendedora | Carteira atribuída + vendas, faturamento, clientes únicos, ticket, canais e metas | 9 |
| Orçamento → pedido → pagamento | Mesmo `Sale.id`, sem recadastro | 7 |
| Cartão, Pix, boleto e cheque | Modelados no pagamento | 8 |
| Condição à vista/pré-datada | Vencimento opcional restrito a boleto/cheque; Pix/cartão rejeitam vencimento | 8 |
| Relatórios de venda/faturamento | API comercial por período | 10 |
| Ticket médio geral/novos/antigos | Calculado sobre vendas pagas | 10 |
| Canais WhatsApp/site/loja | `SaleChannel` | 7/10 |
| Metas | CRUD tenant-scoped com período explícito, métricas `REVENUE`/`SALES`/`CLIENTS`, realizado factual, percentual e atingimento | 9/10 |
| Comissões | Dados-base de venda/pagamento/vendedora prontos; fórmula pendente | 9/10 |
| Atendimento/pós-venda/reclamações/SAC | Histórico de suporte por cliente/venda | 8 |
| Retirada | Registro logístico | 8 |
| Correios e rastreio | Código de rastreio registrado | 8 |
| Envio de rastreio e-mail/WhatsApp | Depende de integração/provedor/template | 8/13 |
| Transportadora e comprovantes | Registro de transportadora + arquivo privado de envio/entrega | 8 |
| Arquivo privado de comprovante | Storage tenant-scoped, privado e protegido por permissão | 8/14 |
| Dashboard comercial | Backend agregado, permission-aware, com metas por vendedora | 10 |

## Etapa 3 — Estoque e Produtos

| Requisito oficial | Implementação atual | Progresso |
|---|---|---|
| Nome, SKU, código de barras | `Product` | 5 |
| Categoria/subcategoria | Dois níveis | 5 |
| Marca/fabricante | `Product.brandManufacturer` | 5 |
| Descrição e atributos técnicos | Campos próprios + JSON técnico | 5 |
| Fotos por variação | `ProductPhoto.variation` | 5 |
| Armazenamento de imagens | Upload público controlado para `PRODUCT_IMAGE` | 5/14 |
| Custo/preço/unidade | Decimal + unidade de medida | 5 |
| Catálogo automático | Catálogo lê diretamente o cadastro de produtos | 12 |
| Link compartilhável | Token público de catálogo | 12 |
| Estoque mínimo/máximo | `ProductStock` | 5/6 |
| Alerta de estoque baixo | Derivado quando quantidade <= mínimo | 6 |
| Produtos com baixa saída | Relatório factual por período, métrica e limiar explicitamente informados; regra automática/padrão continua pendente | 6 |
| Curva ABC | Distribuição factual por período explícito com ranking, participação e acumulado em `REVENUE` ou `SOLD_QUANTITY`; faixas A/B/C ainda pendentes | 6 |
| Categorias por cliente | Calculadas a partir de compras pagas | 6/10 |
| Desconto progressivo | Regra/fórmula pendente | 12 |
| Auto-atacado em até 3 meses | Perfil comercial detecta recompra factual em até 3 meses-calendário sobre vendas `PAID`; efeito comercial ainda pendente | 12 |
| Histórico de formas de pagamento | Endpoint explícito + perfil central com registros pagos/pendentes, valores, vencimento/liquidação e venda/vendedora de origem | 3/8/10 |

## Etapa 4 — Integrações, Promoções e Financeiro

| Requisito oficial | Implementação atual | Progresso |
|---|---|---|
| GoPage | Configuração tenant-scoped preparada; operação real pendente | 13 |
| ShopVax | Configuração tenant-scoped preparada; operação real pendente | 13 |
| WhatsApp | Configuração tenant-scoped preparada; operação real pendente | 13 |
| Gateway de pagamento | Configuração tenant-scoped preparada; provedor/contrato pendentes | 13 |
| E-commerce | Configuração tenant-scoped preparada; operação real pendente | 13 |
| Promoções | Fórmula/prioridade/vigência pendentes | 12 |
| Contas a receber | Derivadas dos pagamentos reais da venda | 11 |
| Contas a pagar | Cadastro, vencimento e baixa | 11 |
| Fluxo de caixa | Entradas recebidas - saídas pagas | 11 |
| Conciliação | Manual e auditada; automação bancária depende de provedor | 11 |
| Relatórios financeiros | Consolidados por período | 11 |
| Domínio próprio | Estrutura de deploy pronta; domínio/DNS/TLS reais pendentes | 14 |
| Compra/assinatura futura | Provisionamento técnico pronto; planos/cobrança pendentes | 14 |

## Infraestrutura e produto

| Requisito oficial | Implementação atual | Progresso |
|---|---|---|
| Multiempresa/multicliente | `Organization` + isolamento em todas as áreas operacionais | 1/14 |
| Dados separados por operação | Tenant scope testado em PostgreSQL e smoke tests | 1/14 |
| Usuários por empresa | Membership + gestão tenant-scoped | 1/14 |
| Provisionamento futuro | Criação transacional de organização + primeiro `OWNER` | 14 |
| VPS/produção | Dockerfile + Compose + procedimento documentado | 14 |
| Banco persistente | PostgreSQL em volume próprio | 1/14 |
| Armazenamento de arquivos | Volume `file_storage`, público/privado por finalidade | 14 |
| Segurança de acesso | RBAC, sessão segura, isolamento, proteção de mutações cross-site, cabeçalhos HTTP e tokens HMAC de arquivo | 1/14 |
| Auditoria | `AuditLog` + consulta administrativa tenant-scoped | 1/14 |
| Backup de banco | Script versionado | 1/14 |
| Backup de arquivos | Serviço/script versionado com retenção configurável | 14 |
| Restore de banco/arquivos | Procedimentos separados; restore de arquivos exige confirmação | 14 |
| Healthcheck | Banco + armazenamento persistente | 1/14 |
| Domínio e TLS definitivos | Dependem do ambiente real | 14 |

## Dependência visual obrigatória

As telas definitivas não são marcadas como fechadas enquanto não forem comparadas com o Stitch aprovado. Isso inclui, no mínimo, Dashboard Geral, Clientes & CRM, Produtos & Estoque, shell/sidebar, tipografia, cores, espaçamentos, cards, tabelas, filtros, campos, botões, ícones, modais, estados e responsividade.

O backend poder estar funcional não transforma uma tela provisória em interface aprovada.

## Regra de fechamento

Um requisito só deve migrar para fechado quando suas partes aplicáveis possuírem:

1. regra funcional definida;
2. persistência/consistência de dados;
3. autorização e isolamento multiempresa;
4. testes correspondentes;
5. interface fiel ao Stitch quando houver interface;
6. integração real homologada quando depender de sistema externo.
