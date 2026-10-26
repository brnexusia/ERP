# Painel administrativo de registros de integrações

A rota `/integrations` usa os componentes visuais operacionais do ERP e fica restrita a `integrations:manage` (OWNER/ADMIN). A configuração permanece separada por empresa.

O operador pode cadastrar `provider`, `key`, `displayName`, marcar o registro como habilitado/desabilitado e consultar o estado reportado pelo sistema. A edição reutiliza o upsert auditado existente, preservando referências de segredo preexistentes quando omitidas.

### Restrições de segurança

- A interface **não solicita nem renderiza** tokens, senhas, segredos brutos, configurações JSON ou referência `secretRef`; apenas a indicação booleana `secretConfigured`.
- A conexão **não acontece pelo cadastro**. O registro habilitado sem conexão comprovada permanece `DISCONNECTED`.
- Provedores ainda exigem endpoints, credenciais reais, URLs e contratos de eventos. Nenhuma simulação de chamada a VaxChat/VaxLab/ShopVax/GoPage/WhatsApp/gateway/e-commerce substitui integração real.
- O estado de conexão registrado pelo runtime não certifica funcionamento atual sem healthcheck de provedor.

### Aceite

`pnpm test:smoke-integration-registry-page` valida acesso owner, 404 a vendedor, 403 via API, inclusão habilitada/desabilitada sem conexão falsa, ausência de `secretRef` no JSON e limpeza de registros de teste. CI testa também build, tipos e isolamento PostgreSQL.

O visual definitivo depende da comparação com o Stitch exportável. O escopo de integrações externas não pode ser marcado concluído até contratos e testes reais.
