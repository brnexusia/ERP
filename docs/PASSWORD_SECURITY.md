# Alteração segura de senha

## Fonte

O documento-fonte oficial exige estrutura web com login e senha, controle de acesso à plataforma e infraestrutura com segurança de acesso e controle de usuários.

## Fluxo implementado

A rota autenticada `POST /api/auth/password` permite que o próprio usuário altere sua senha informando:

- senha atual;
- nova senha com no mínimo 10 caracteres.

A alteração só é aceita quando a senha atual confere com o hash persistido. A nova senha não pode ser igual à senha atual.

## Persistência e revogação

A nova senha é processada pelo mesmo mecanismo `scrypt` já utilizado no restante da autenticação.

Depois da troca:

- o hash anterior é substituído;
- todas as outras sessões do mesmo usuário são revogadas, inclusive sessões abertas em outras empresas;
- a sessão que confirmou conscientemente a troca permanece ativa;
- a operação gera auditoria `AUTH_PASSWORD_CHANGE` no tenant ativo, sem registrar senha ou hash no log.

Esse comportamento evita manter sessões paralelas antigas válidas depois de uma troca voluntária de credencial, sem alterar o contrato normal de sessão ou de troca de empresa.

## Respostas de segurança

- sem sessão válida: `401`;
- senha atual incorreta: `400`;
- nova senha igual à atual: `422`;
- dados inválidos/curtos: `400`.

Nenhuma resposta retorna o hash persistido.

## Validação

O smoke test cria um usuário dedicado, abre duas sessões independentes e valida:

1. rejeição de senha atual incorreta sem revogar sessões;
2. rejeição de reutilização da senha atual;
3. troca bem-sucedida;
4. manutenção da sessão que executou a troca;
5. revogação da outra sessão;
6. rejeição da senha antiga em novo login;
7. autenticação com a nova senha;
8. registro da auditoria correspondente.
