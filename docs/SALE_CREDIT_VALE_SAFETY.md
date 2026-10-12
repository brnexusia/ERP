# Fechamento seguro — compra a prazo e vale

## Regras implementadas

- Boleto/cheque **pendente** só pode ser incluído se o gestor autorizou compra a prazo para aquela modalidade e existe limite de crédito disponível.
- A reserva da parcela é criada no livro de crédito junto com o pagamento, de forma atômica, com auditoria do usuário e identificação do pagamento.
- Ao quitar a parcela, a reserva **criada por esta funcionalidade** é liberada, sem alterar reservas legadas/manuais.
- Um lançamento de VALE quitado só é aceito se existir saldo suficiente no vale do cliente. O saldo é consumido uma vez, na mesma transação do pagamento. VALE pendente só consome saldo ao ser quitado.
- VALE, que é um crédito pré-pago, não é contado como nova entrada de caixa nem pode ser conciliado como recebimento bancário.
- Tentativas de autorizar sem saldo/crédito, supervalor, dupla quitação e lançamentos sem permissão retornam erro sem movimentação parcial.

## Limitações e transição

- Esse código altera regras para **novos** boletos/cheques pendentes. Clientes existentes com política ainda não configurada precisam de aprovação do gestor e limite para novas parcelas.
- Pagamentos anteriores às reservas automáticas permanecem preservados: sua quitação não inventa crédito ou baixa de saldo inexistente.
- Não substitui contabilidade de cheque devolvido, cobrança automática, comissões, estoque por cor/dúzia ou integração real VaxChat/VaxLab.
- A operação da VPS e o banco real **não foram acessados**. Antes do deploy: backup e testes de homologação de vendas reais, especialmente contas com limites e vales legados.
- Design original do Stitch ainda depende de comparação de telas reais da VPS e fontes de alta resolução. Não declarado pixel-perfect.

## Gate técnico

A suíte CI valida autorização do gestor, rejeição por limite insuficiente, reserva e liberação de crédito, rejeição de vale sem saldo, resgate único do vale e exclusão de VALE do fluxo de caixa, além de isolamento entre empresas, permissões, migrations, typecheck, build e backup/restore.
