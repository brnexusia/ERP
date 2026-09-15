# ERP Pedro

ERP web multiempresa para a operação Pedro, com arquitetura preparada para futura comercialização pela Vax/Arles.

## Fontes oficiais

- **Escopo funcional:** `ERP_Pedro_Escopo_Oficial.pdf` (documento-fonte do projeto).
- **Referência visual:** Stitch aprovado. O Stitch prevalece para layout, componentes, navegação e comportamento visual.
- **Regra de execução:** nenhuma funcionalidade aprovada deve ser removida ou alterada silenciosamente; mudanças de escopo devem ser registradas.

## Progresso atual

**Progresso 1 — Fundação do sistema: EM CONSTRUÇÃO**

Objetivos desta fundação:

- aplicação web em TypeScript;
- PostgreSQL;
- isolamento multiempresa desde o banco;
- autenticação e controle de acesso preparados;
- usuários e vínculos por empresa;
- auditoria;
- infraestrutura local reproduzível;
- base para integrações sem acoplar o core do ERP a automações externas.

Acompanhe os marcos em `docs/PROGRESS.md` e as decisões em `docs/ARCHITECTURE.md`.

## Princípio de arquitetura

Toda entidade operacional futura (clientes, vendedores, produtos, estoque, vendas e financeiro) deve pertencer explicitamente a uma empresa/tenant. Consultas da aplicação nunca devem misturar dados entre empresas.
