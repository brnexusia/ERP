# Produtos, estoque e catálogo público — execução operacional

## Escopo entregue neste branch

- `/products`: listagem pesquisável, filtro por categoria e sinalização de estoque abaixo ou igual ao mínimo; visualiza produto, unidade, preço de venda, fabricante, SKU, código de barras, fotos, categoria e subcategoria.
- Gestão autorizada (`inventory:write`): cadastro e alteração de produtos, criação de categorias e subcategorias, movimentação **manual** do estoque existente por atualização auditada, inclusão de fotos/variações pelo armazenamento público do ERP e geração de link do catálogo.
- Leitura (`inventory:read`): apresenta dados permitidos sem custo de aquisição para `SELLER`, `FINANCE`, `SUPPORT` e `VIEWER`. As APIs continuam impondo autorização e isolamento por empresa independentemente do menu.
- `/catalog/[token]`: página pública de leitura, gerada diretamente dos produtos reais da organização do token. Exibe preço de venda e disponibilidade factual; jamais custo de aquisição. Catálogo de organização inativa e token inexistente respondem `404`. O endpoint JSON `/api/catalog/[token]` é preservado para compatibilidade. Novos links gerados por `/api/catalog-share` apontam à página visual.
- Formulário de atributos técnicos preserva apenas objeto JSON com valores primitivos e submete aos mesmos esquemas de validação das APIs.

## Critérios de aceite e limites

O ERP não presume momento de baixa/reserva automática: o estoque é alterado **somente** pela ação manual já existente. Também não aplica descontos, auto-atacado, promoções ou classificações ABC automáticas sem regras aprovadas.

O catálogo público é uma interface adicional operacional; seu layout ainda precisa de homologação contra os arquivos editáveis do Stitch. O modelo de autorização, registros auditados e segregação continuam a cargo dos módulos existentes.

### Validação

`pnpm typecheck`, `pnpm build` e `pnpm test:smoke-product-workspace` (aplicação e PostgreSQL em execução). O smoke cria produto/categoria descartáveis, testa o link público com e sem autenticação, proteção do custo e 404 para token inexistente. A suíte CI executa também os demais testes já existentes.

## Dependências externas não resolvidas

Arquivos completos do Stitch para comparação visual detalhada; fórmulas de descontos e promoções; políticas de estoque; contrato e credenciais de integrações VaxChat/VaxLab/GoPage/ShopVax/WhatsApp/gateway; infraestrutura de produção.
