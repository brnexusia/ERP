# Segurança de sessão e troca de empresa

## Fonte

O documento-fonte oficial exige login/senha, controle de acesso à plataforma, isolamento por empresa e segurança de acesso/controle de usuários.

## Sessão

A autenticação usa token aleatório de 256 bits armazenado apenas no cookie do navegador. O banco recebe somente o hash SHA-256 do token.

O cookie de sessão permanece:

- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` em produção;
- restrito ao caminho `/`;
- com expiração absoluta persistida também no banco.

## Rotação ao trocar de empresa

A troca do tenant ativo é uma mudança de contexto de autorização. Depois de confirmar que o usuário possui `Membership` válida na empresa de destino, o ERP agora:

1. gera um novo token criptograficamente aleatório;
2. substitui o hash persistido na mesma sessão;
3. altera a empresa ativa;
4. atualiza `lastSeenAt`;
5. entrega o novo cookie mantendo a expiração original.

O token anterior deixa de corresponder a qualquer sessão imediatamente. Assim, uma cópia antiga do cookie não continua válida depois que o usuário muda de empresa.

## Falha de autorização

Se a empresa solicitada não possuir membership válida ou estiver inativa, a troca é recusada e nenhum novo token é emitido. A sessão legítima existente permanece válida no tenant atual.

## Proteções complementares já existentes

A rotação trabalha em conjunto com:

- validação de membership a cada leitura da sessão;
- rejeição de empresa ou usuário inativo;
- bloqueio de mutações API cross-site por `Origin`/`Sec-Fetch-Site`;
- RBAC no servidor;
- guards de consistência multiempresa no PostgreSQL;
- revogação de sessões quando o acesso à empresa é removido;
- logout com remoção da sessão persistida.

## Validação

O smoke test de autenticação verifica que:

- a troca autorizada retorna um token diferente;
- o cookie anterior não consegue mais acessar a aplicação;
- o novo cookie opera no tenant correto;
- uma troca para empresa sem membership retorna `403` e não emite novo cookie;
- a proteção cross-site e o logout continuam funcionando depois da rotação.
