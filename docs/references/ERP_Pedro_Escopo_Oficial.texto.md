# ERP Pedro — Escopo oficial (transcrição do PDF)

> Transcrição pesquisável do conteúdo textual do arquivo original enviado pelo usuário. Não é o PDF original: elementos gráficos, diagramas, vetores e imagens embutidas não estão preservados neste Markdown. Fonte: ERP_Pedro_Escopo_Oficial(1).pdf.
> Em caso de divergência, a referência original e decisões posteriores explicitamente aprovadas prevalecem. Não utilizar preços/limites históricos para sobrescrever parâmetros atuais.

\n\n---\n\n## Página 1 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 1
ERP PEDRO
Escopo oficial, roadmap e referências visuais
DOCUMENTO-FONTE DO PROJETO
Este documento consolida o escopo funcional, as quatro etapas de desenvolvimento, as regras de arquitetura e as
referências visuais oficiais do ERP. O objetivo é servir como fonte única para implementação, validação e 
evolução do sistema.
Planejamento total 120 dias
Estrutura 4 etapas de 30 dias
Plataforma ERP web completo
Referência visual obrigatória Stitch
Versão consolidada - 15/09/2026
\n\n---\n\n## Página 2 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 2
1. Diretriz visual obrigatória
O STITCH É A FONTE VISUAL OFICIAL
O ERP deve reproduzir fielmente as telas aprovadas no Stitch. O Stitch não deve ser tratado como inspiração, 
referência aproximada ou ponto de partida para um novo design. Quando houver divergência entre uma 
interpretação do desenvolvimento e o que estiver no Stitch, prevalece o Stitch.
A implementação deve preservar a mesma estrutura visual e de navegação das fontes do Stitch, incluindo:
 estrutura das páginas e sidebar
 cabeçalhos, cards, dashboards, tabelas e gráficos
 cores, tipografia, espaçamentos e hierarquia visual
 botões, ícones, campos, filtros, modais e estados dos componentes
 organização das informações e experiência de navegação
 responsividade e consistência entre módulos
As telas já desenhadas no Stitch incluem, como referência principal, o Dashboard Geral, Clientes & CRM, Produtos &
Estoque e o design system do ERP. Novas telas que ainda não existirem devem seguir exatamente o mesmo padrão 
visual e de componentes.
Referência visual principal: telas e design system do ERP no Stitch.
\n\n---\n\n## Página 3 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 3
2. Referências de alinhamento do projeto
As imagens abaixo registram o alinhamento de escopo, roadmap e aprovação visual do projeto. Elas ficam 
anexadas ao documento como contexto de origem das decisões consolidadas neste escopo.
Registro de alinhamento sobre roadmap, quatro etapas, infraestrutura e visão do ERP como produto.
Registro de aprovação e alinhamento da linha visual criada no Stitch.
\n\n---\n\n## Página 4 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 4
3. Estrutura geral e roadmap
O desenvolvimento é dividido em quatro etapas sequenciais, com planejamento de 30 dias por etapa. O prazo de 
referência completo é de 120 dias.
OBJETIVO DE EXECUÇÃO
Sempre que tecnicamente possível, módulos utilizáveis podem ser antecipados para uso real antes do 
encerramento dos 120 dias, desde que isso não reduza a qualidade, não quebre a arquitetura e não altere o 
escopo aprovado.
Etapa Duração Foco principal
1 30 dias Gestão de Clientes
2 30 dias Vendas, Relatórios e Comissões
3 30 dias Estoque e Produtos
4 30 dias Integrações, Promoções e Financeiro
Visão do produto
O ERP deve ser construído para atender inicialmente a operação do projeto Pedro, mas sua arquitetura precisa 
considerar evolução para um produto comercial da Vax em parceria com a Arles, permitindo que novos clientes 
assinem e utilizem a plataforma futuramente.
 estrutura multiempresa/multicliente preparada desde a arquitetura
 isolamento de dados por empresa
 usuários, vendedores, clientes, produtos, estoque e financeiro separados por operação
 configurações e integrações próprias por cliente
 possibilidade futura de contratação/assinatura e provisionamento de novas contas
\n\n---\n\n## Página 5 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 5
ETAPA
1
Gestão de Clientes - base do sistema
30 dias
Construir a base do ERP e centralizar toda a gestão de clientes, relacionamento e acesso 
à plataforma.
1. Cadastro completo de clientes
 Nome ou razão social
 CPF ou CNPJ
 Endereço completo
 WhatsApp e e-mail
 Histórico de compras
2. Linha de crédito
 Registro do limite por cliente
 Limite utilizado
 Limite disponível
 Histórico de utilização
3. Vale do cliente
 Saldo ou vale disponível
 Histórico de movimentações
 Campos para lançamento pelas vendedoras
4. Segmentação
 Classificação por grupo/perfil, como Grupo A, Grupo B e demais segmentos definidos pela empresa
5. Aviso de inatividade
 Configuração de X dias sem compra
 Alerta automático ao atingir o período definido
6. CRM integrado
 Histórico de relacionamento
 Acompanhamento comercial
 Atividades e informações relacionadas ao cliente
7. Gestão central do cliente
 O módulo do cliente deve concentrar informações comerciais, financeiras e de relacionamento
8. Estrutura web
 Login e senha
 Controle de acesso à plataforma
9. Integrações iniciais
 VaxChat
 VaxLab
\n\n---\n\n## Página 6 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 6
ETAPA
2
Vendas, Relatórios e Comissões
30 dias
Construir a operação comercial completa, do perfil do cliente ao pagamento, entrega, 
performance e comissionamento.
1. Classificação de clientes
 Quem compra mais
 Quem reduziu compras
 Quem parou de comprar
 Clientes novos e recorrentes
2. Direcionamento comercial
 Vincular clientes aos vendedores responsáveis
3. Perfil do cliente para as vendedoras
 Dados comerciais
 Histórico
 Compras
 Relacionamento
4. Fluxo completo de venda
 Orçamento -> pedido -> pagamento
5. Formas de pagamento
 Cartão
 Pix
 Boleto à vista ou pré-datado
 Cheque à vista ou pré-datado
6. Registro por venda
 Cliente
 Produto comprado
 Quantidade
 Forma de pagamento
 Vendedora responsável
 Data e valores
7. Desempenho e comissões
 Relatórios por vendedora
 Página de comissões
 Vendas, faturamento, clientes, metas e indicadores individuais
8. Ticket médio
 Ticket médio geral
 Clientes novos
 Clientes antigos
 Filtros por período
\n\n---\n\n## Página 7 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 7
ETAPA
2
Vendas, Relatórios e Comissões - continuação
30 dias
Continuação do módulo comercial, com canais, metas, atendimento, logística e 
dashboards.
9. Vendas por canal
 WhatsApp
 Site
 Loja física
10. Metas por vendedora
 Definição e acompanhamento de metas
 Indicadores de performance
 Apoio a treinamento e desenvolvimento
11. Suporte ao cliente
 Atendimento
 Pós-venda
 Reclamações
 SAC
12. Acompanhamento de entrega
 Retirada: registro da retirada
 Correios: código de rastreio e envio por e-mail/WhatsApp
 Transportadora: registro e comprovante de envio/entrega
13. Dashboards comerciais
 Vendas
 Faturamento
 Performance
 Metas
 Vendedores
 Clientes
 Demais indicadores comerciais
FLUXO COMERCIAL CENTRAL
O orçamento deve evoluir para pedido e, em seguida, para pagamento sem duplicação de cadastros. As 
informações precisam permanecer vinculadas ao mesmo cliente, vendedor e histórico comercial durante todo o 
fluxo.
\n\n---\n\n## Página 8 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 8
ETAPA
3
Estoque e Produtos
30 dias
Centralizar cadastro de produtos, estoque, catálogo e inteligência comercial relacionada 
aos itens vendidos.
1. Cadastro completo de produtos via servidor
 Nome
 SKU
 Código de barras
 Categoria e subcategoria
 Marca/fabricante
 Descrição detalhada
 Atributos técnicos
 Fotos, inclusive por variação
 Preço de custo e preço de venda
 Unidade de medida
2. Catálogo automático
 Gerado a partir dos produtos cadastrados
 Compartilhável por link
3. Estoque mínimo e máximo
 Definição por produto
 Aviso automático de estoque baixo
4. Produtos com baixa saída
 Identificação de itens vendendo pouco
 Alertas e indicadores
5. Curva ABC
 Classificação de produtos por importância, faturamento e giro
6. Análise por categoria
 Identificar categorias predominantes no histórico de compra de cada cliente, por exemplo brincos, colares ou 
pulseiras
7. Descontos progressivos
 Regras por quantidade, categoria ou volume
 Exemplo: preço diferenciado para dúzia fechada
8. Regra de auto-atacado
 Classificação/regra baseada em recompra dentro de período de até 3 meses
9. Histórico de formas de pagamento
 Pix
 Cartão
 Boleto
 Demais formas utilizadas
\n\n---\n\n## Página 9 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 9
ETAPA
4
Integrações, Promoções e Financeiro
30 dias
Completar a infraestrutura do ERP, suas integrações externas, promoções e gestão 
financeira.
1. Integração com GoPage
 Integração operacional com o ecossistema GoPage
2. Integração com ShopVax
 Integração operacional com o ShopVax
3. WhatsApp
 Vínculo completo do ERP ao WhatsApp
4. Pagamentos e e-commerce
 Integração com gateways de pagamento
 Integração com e-commerce
 Integrações necessárias à operação
5. Promoções
 Tabela de promoções identificada dentro do ERP
 Promoções por categoria
 Promoções por produto
 Progressivas por valor
 Progressivas por quantidade
6. Módulo financeiro
 Contas a receber
 Contas a pagar
 Fluxo de caixa
 Conciliação bancária
 Relatórios financeiros
7. Domínio próprio
 Acesso ao ERP em domínio próprio
 Estrutura preparada para acesso adicional de compra/assinatura quando comercializado
\n\n---\n\n## Página 10 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 10
4. Infraestrutura e arquitetura
A infraestrutura deve ser preparada para operação segura, crescimento do volume de dados e futura 
comercialização do ERP.
 configuração de VPS e ambiente de produção
 conta/e-mail empresarial apropriado para serviços do projeto
 banco de dados e armazenamento de arquivos/produtos
 segurança de acesso e controle de usuários
 backups e recuperação
 domínio e configuração de produção
 arquitetura preparada para crescimento e múltiplas empresas
5. Ordem de prioridade
1 Sistema funcional e dados corretos
2 Interface fiel ao Stitch
3 Integrações
4 Automação e inteligência de dados
5 Preparação para comercialização como produto
REGRA DE QUALIDADE
A fidelidade visual ao Stitch não é opcional, mas a lógica do sistema também não pode ser sacrificada para 
reproduzir apenas a aparência. O resultado deve unir design do Stitch, funcionalidades deste documento, 
arquitetura escalável e integrações Vax/Arles.
\n\n---\n\n## Página 11 de 11\n\n
ERP PEDRO | DOCUMENTO-FONTE OFICIAL
Página 11
6. Regras para alterações de escopo
Este documento representa a base oficial do ERP Pedro. Alterações e novas funcionalidades devem ser tratadas de 
forma controlada, mantendo rastreabilidade do que foi aprovado.
 Funcionalidades adicionais não previstas devem ser avaliadas antes de entrar no desenvolvimento.
 Uma nova função não deve remover ou alterar silenciosamente funcionalidades já aprovadas.
 Mudanças no layout não devem ser feitas por preferência do desenvolvimento quando existir referência 
correspondente no Stitch.
 Quando uma nova tela não existir no Stitch, ela deve reutilizar o design system, padrões de componentes e hierarquia
visual já aprovados.
 A antecipação de prazo não autoriza redução de escopo, perda de qualidade ou atalhos que prejudiquem a evolução 
do produto.
Resumo executivo
ERP WEB COMPLETO
4 etapas de 30 dias, totalizando 120 dias de planejamento. Etapa 1: Clientes + CRM + estrutura web + 
VaxChat/VaxLab. Etapa 2: Vendas + vendedores + comissões + relatórios + entregas + SAC. Etapa 3: Produtos + 
estoque + catálogo + Curva ABC + inteligência de produtos. Etapa 4: Integrações + promoções + financeiro + 
domínio + preparação comercial.
REFERÊNCIA VISUAL
Stitch. O ERP final deve reproduzir fielmente as fontes e telas aprovadas no Stitch, mantendo o mesmo design 
system e comportamento visual em toda a plataforma.
