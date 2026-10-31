# Sigilo dos metadados do vínculo de vendedora

## Risco encontrado (27/10/2026)

Após a primeira correção que deixou de retornar `User.passwordHash`, algumas consultas ainda incluíam um objeto completo de `Membership` ao buscar `responsibleSeller` ou `seller`. Essa tabela possui `commissionPercent` e os objetos eram serializados em respostas de cadastro de clientes, perfil comercial/central, vendas, ranking, alertas de inatividade e financeiro, inclusive quando a função do usuário não exigia consultar taxas.

## Ajuste concluído tecnicamente

Os relacionamentos retornados nesses módulos usam um `select` explícito com os campos de identificação necessários: `id`, `userId`, `role` e dados públicos mínimos do usuário (`id`, `name`), sem incluir `commissionPercent`. O serviço especializado que permite à gestão configurar as comissões preserva a taxa e seus requisitos de autorização.

Regressões via API verificam ausência de `commissionPercent` dentro dos vínculos aninhados do cliente, vendedor de uma venda e contas a receber, além dos testes existentes para hashes de senha.

## Limites desta medida

- **Não altera** valores de comissão congelados na própria venda (`sellerCommissionRate`), taxas de representantes (`representativeRate`) nem os processos de prévia/fechamento de comissão; políticas para exposição desses outros campos requerem revisão separada de permissões e escopo de visibilidade.
- Não modifica valores, fórmulas, competência, fechamento ou cálculo de comissões.
- Uma CI verde só comprova a classe de regressão testada; homologação em produção e decisões comerciais permanecem abertas.

Esta branch deriva da correção de inatividade e da consolidação anterior, e portanto não deve ser mesclada em duplicidade com PRs de dependência.
