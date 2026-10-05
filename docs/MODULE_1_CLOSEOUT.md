# Fechamento controlado — Etapa 1 / Gestão de Clientes

Este documento registra o gate da primeira etapa do ERP Pedro. A Etapa 1 é tratada como dependência obrigatória antes de avançar a construção da Etapa 2.

## Escopo funcional da Etapa 1

| Requisito | Estado | Evidência principal |
|---|---|---|
| Cadastro completo de clientes | Funcional | `Client`, `ClientAddress`, `/api/clients`, interface `/clients` |
| Histórico de compras | Funcional | perfil comercial/central sobre vendas pagas |
| Linha de crédito | Funcional | limite, utilizado, disponível, movimentos e auditoria |
| Vale do cliente | Funcional | saldo, movimentos, regras e auditoria |
| Segmentação | Funcional | grupos tenant-scoped + atribuição no perfil |
| Aviso de inatividade | Funcional | X dias configurável + alertas pela última compra paga |
| CRM integrado | Funcional | atividades, follow-up, conclusão e timeline |
| Gestão central do cliente | Funcional | `/api/clients/:id/central-profile` + interface central |
| Login/senha/acesso | Funcional | sessão, RBAC, troca de senha e isolamento multiempresa |
| VaxChat | Bloqueio externo | registry/configuração pronta; falta contrato técnico e credencial real |
| VaxLab | Bloqueio externo | registry/configuração pronta; falta contrato técnico e credencial real |
| Interface Stitch | Homologação pendente | interface operacional existe; fonte completa do Stitch ainda é necessária para comparação fiel |

## Interface operacional adicionada

A rota `/clients` passou a expor a operação real da Etapa 1: listagem e busca, cadastro completo, alertas de inatividade, perfil central, segmentação, crédito, vale e CRM. A rota `/clients/settings` concentra a regra de inatividade, criação de grupos e estado das integrações VaxChat/VaxLab.

Esta interface não é declarada como visual final. O documento oficial exige fidelidade ao Stitch e a referência atualmente disponível no PDF não contém detalhe suficiente de todos os componentes, estados e responsividade para uma homologação tela a tela.

## Gate automatizado

O comando `pnpm test:module-1` executa a validação focada da Etapa 1:

- autenticação/sessão e isolamento;
- cadastro, segmentação, crédito, vale, CRM e inatividade;
- perfil central e histórico de pagamentos;
- registro seguro de VaxChat/VaxLab sem expor referências de segredo;
- troca autenticada de senha.

Além desse gate, o CI continua executando typecheck, build, migrations e a suíte completa.

## Condição para marcar a Etapa 1 como ✅ Fechada

Todos os itens internos estão implementados e podem entrar em homologação. O status final ✅ só pode ser atribuído quando os dois bloqueios externos restantes forem resolvidos:

1. fonte completa do Stitch para validar a interface final, incluindo estados e responsividade;
2. documentação/URLs/autenticação/credenciais e contrato de eventos de VaxChat e VaxLab para chamadas e sincronização reais.

Até lá, o módulo deve ser tratado como **funcional e em homologação**, sem iniciar alterações de escopo da Etapa 2 que dependam de um fechamento falso da Etapa 1.
