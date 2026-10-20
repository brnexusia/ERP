# Módulo 2 — Operação de entrega no ERP

## Interface incorporada

A tela `/sales` (Vendas & Pedidos) apresenta o painel **Logística & Entrega** após o orçamento ser confirmado. O painel usa as rotas já existentes para registrar e consultar:

- Retirada na loja: data e horário informados pelo operador.
- Correios: código de rastreio.
- Transportadora: nome do responsável pelo transporte; depois do registro, comprovantes privados de envio e entrega.

A visualização é permitida aos usuários comerciais com acesso ao pedido. O envio ou alteração requer `sales:write`; o servidor também exige, para o primeiro registro de entrega de novos pedidos, o status **VERIFIED** de separação e conferência realizada por pessoas distintas. Isso não é contornado pela interface. Pedidos antigos seguem a política de preservação anterior.

A troca de modalidade pede confirmação explícita porque pode substituir campos do registro logístico. Anexos ficam armazenados no armazenamento privado atual; a interface indica se já estão anexados e não oferece substituição silenciosa. O servidor continua responsável por validar formato, permissões e tamanho.

## Limites

- **Não envia WhatsApp, e-mail nem eventos automáticos de rastreio**. O módulo informa a situação registrada; integrações reais dependem de provedores, modelos de mensagem e contratos técnicos.
- Não cria nem envia etiquetas dos Correios ou de transportadoras.
- Não modifica o momento de baixa de estoque, as regras financeiras ou os documentos fiscais.
- Não autoriza provar a fidelidade visual exata ao Stitch sem comparação objetiva com as telas aprovadas.

## Verificação técnica

O smoke existente cobre orçamento sem direito a entrega, primeiro envio bloqueado sem conferência, verificação por segundo funcionário, modalidades PICKUP/CORREIOS/CARRIER, atualização mantendo identificador de entrega, auditoria e isolamento multiempresa. A suíte de comprovantes valida upload privado e restrições. Teste adicional cobre a rota autenticada `/sales` e a recusa de acesso anônimo.

O PR não tem migração nem altera a VPS. Após o CI aprovado, a publicação no EasyPanel deve ser decidida separadamente e homologada visualmente com as referências do Stitch.
