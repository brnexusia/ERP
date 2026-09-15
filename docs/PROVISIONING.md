# Provisionamento de empresas — ERP Pedro

## Objetivo

A arquitetura do ERP foi preparada para receber novas empresas sem misturar dados entre operações. O documento-fonte exige estrutura multiempresa/multicliente, isolamento por empresa e possibilidade futura de contratação/assinatura e provisionamento de novas contas.

Este fluxo implementa **provisionamento técnico controlado**. Ele não representa ainda um checkout, plano comercial ou assinatura automática.

## O que o provisionamento cria

Uma execução bem-sucedida cria, de forma transacional:

1. uma `Organization` ativa;
2. um `User` ativo para o primeiro proprietário;
3. uma `Membership` `OWNER` ligando o usuário à empresa;
4. um registro de auditoria `ORGANIZATION_PROVISIONED`.

Se qualquer etapa falhar, a operação é revertida e não deve permanecer uma empresa parcialmente criada.

## Como executar

Defina as variáveis:

```bash
PROVISION_ORG_NAME="Nome da Empresa"
PROVISION_ORG_SLUG="nome-da-empresa"
PROVISION_OWNER_NAME="Nome do Proprietário"
PROVISION_OWNER_EMAIL="proprietario@empresa.com"
PROVISION_OWNER_PASSWORD="senha-com-10-ou-mais-caracteres"
```

Depois execute:

```bash
pnpm db:provision
```

A saída contém apenas os identificadores e dados públicos criados. O hash de senha não é exposto.

## Regras de segurança

- O slug da organização deve ser único.
- O e-mail global do usuário também deve ser único neste fluxo.
- Se o e-mail já existir, o provisionamento é rejeitado para impedir redefinição silenciosa da senha de um usuário que já participa de outra empresa.
- Para vincular um usuário já existente a outra empresa, deve ser usada a gestão de acessos/memberships, não o provisionamento inicial.
- O primeiro usuário da nova empresa recebe papel `OWNER`.
- A operação deixa trilha de auditoria.

## Gestão de usuários dentro da empresa

Após o provisionamento, usuários com permissão `users:manage` podem administrar os acessos da empresa por API tenant-scoped:

- `GET /api/users` — listar usuários da empresa ativa;
- `POST /api/users` — criar/vincular acesso;
- `PATCH /api/users/:membershipId` — alterar papel;
- `DELETE /api/users/:membershipId` — remover acesso.

Proteções implementadas:

- usuários operacionais sem `users:manage` não administram acessos;
- uma empresa não enxerga ou altera memberships de outra empresa;
- somente `OWNER` pode criar, alterar ou remover outro `OWNER`;
- o último `OWNER` não pode ser removido/rebaixado;
- a rota não permite auto-rebaixamento nem auto-remoção;
- remoção de membership revoga sessões daquele usuário na empresa correspondente;
- criação, alteração de papel e remoção ficam auditadas.

## O que continua fora deste fluxo

Ainda não existe regra aprovada para:

- planos;
- preços;
- cobrança recorrente;
- checkout/contratação;
- ativação automática após pagamento;
- suspensão/cancelamento por assinatura;
- domínio comercial definitivo.

Quando essas regras forem definidas, o processo comercial deverá chamar a mesma camada de provisionamento, em vez de criar uma segunda forma de abrir tenants.

## Validação

A suíte de CI valida criação de nova empresa, primeiro proprietário, autenticação, acesso tenant-scoped, rejeição de duplicidade, ausência de estado parcial em falha e gestão isolada de usuários.
