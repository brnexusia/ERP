# Central de alertas operacionais — escopo oficial

Fonte: `ERP_Pedro_Escopo_Oficial.pdf`, Etapa 1 (aviso de X dias sem compra) e Etapa 3 (estoque mínimo e alerta automático).

## Implementação

- Página privada `/alerts` e endpoint `GET /api/alerts`. O alerta é recalculado no momento da consulta com `Cache-Control: private, no-store`.
- **Inatividade:** reutiliza o serviço de inatividade aprovado. O limiar é o override individual ou a configuração por empresa, com dias sem compra calculados usando a última venda `PAID`; para cliente sem compra, usa-se a data do cadastro, conforme lógica existente.
- **Estoque:** sinaliza produto quando a quantidade factual `<=` o estoque mínimo configurado. Não dá baixa física, não reserva estoque nem faz pedido automaticamente.
- RBAC: consulta cada conjunto somente com suas permissões de leitura; todas as consultas limitadas ao tenant ativo.
- Privacidade: resposta projetada contém apenas nome/identificador do cliente, contagem de dias/limiar, vendedora de referência; produto, SKU, quantidade/mínimo/unidade. Sem preços de custo, dados pessoais adicionais ou payload integral do produto.
- Interface com contadores, busca local, grupos e acesso aos módulos correspondentes, reutilizando cores e componentes comuns do ERP.

**Sem notificações externas ou job agendado.** Alerta in-app automático significa detectar condições com base nos dados na hora da leitura. Disparar e-mail/WhatsApp exige provedor, regras de reenvio e consentimentos ainda não estabelecidos. A fidelidade exata ao Stitch ainda exige os assets exportáveis do design aprovado.

## Gate de regressão

`pnpm test:smoke-alert-center` roda no GitHub Actions com PostgreSQL temporário:
- anônimo recebe 401 na API e redirecionamento da página;
- cliente com 4 dias desde cadastro e limiar 1 aparece; cliente com limite não atingido não aparece;
- produto com 2 unidades e mínimo 3 aparece; produto com 15 unidades não aparece;
- o mesmo tenant não vê cliente/produto de outra empresa, nem preços de custo;
- vendedora autorizada consulta os alertas sem receber custo;
- elevar o limiar e repor quantidade remove os alertas na próxima consulta, sem alterar vendas.

O teste elimina somente os próprios fixtures e sessões, não as configurações ou dados anteriores da empresa.

## Navegação até a origem

Cada alerta aponta para a entidade exata, com `/clients?client=<id>` e `/products?product=<id>`, em vez de abrir apenas a lista geral. O servidor valida o identificador recebido e a API continua exigindo sessão, autorização e empresa ativa. Um identificador externo não concede acesso à outra organização.

A suíte Playwright desktop/mobile valida os dois caminhos com dados criados e removidos dentro de testes descartáveis.
