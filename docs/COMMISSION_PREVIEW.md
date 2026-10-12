# Comissões — prévia gerencial (Etapa 2)

## Implementado

- Gestor define percentual de comissão da vendedora, ou deixa vazio para sem comissão; histórico auditável.
- Ao confirmar orçamento como pedido, o percentual da vendedora é congelado no pedido, impedindo recalcular pedidos já fechados depois de uma mudança de cadastro.
- Prévia gerencial por competência: vendas confirmadas da vendedora, total e comissão, com vencimento no dia 15 do mês seguinte.
- Prévia por representante: comissão calculada parcela a parcela para cheque/boleto/vale, na data de vencimento registrada, independentemente da compensação; usa percentual congelado na venda.
- Restrição de acesso OWNER/ADMIN/MANAGER/FINANCE. Somente gestão altera percentuais.
- Tela de consulta em `/commissions` seguindo design system atual.

## Limitações importantes

- Trata-se de **prévia**; não gera contas a pagar, não liquida comissões e não faz estorno por cheque devolvido.
- Pedidos anteriores à adoção da taxa congelada têm `sellerCommissionRate=NULL`, sem cálculo retroativo especulativo.
- A competência comercial está interpretada em `America/Sao_Paulo` (2026, UTC-3); requer timezone configurável por empresa antes de comercialização multi-região.
- Parcelas sem data de vencimento não aparecem na prévia por vencimento; o fluxo futuro precisa garantir essa data.
- Não há taxa padrão: cada vendedor/representante configura a própria taxa e a gestão aprova mudanças.

## Verificações

Teste de permissão, taxa, competência e cálculo de parcelas no smoke test, seguido do gate habitual de migration, typecheck, build, isolamento, backup e smoke completos.
