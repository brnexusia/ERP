# Módulo 2 — Central de Atendimento & SAC

## Entrega

A nova tela `/support` ativa o item Atendimento & SAC no menu e reutiliza os registros de suporte existentes. Mantém quatro categorias previstas no banco: Atendimento, Pós-venda, Reclamação e SAC. Usuários com `clients:write` registram observações para cliente cadastrado, com possível vinculação a pedido do próprio cliente. Usuários com `clients:read` consultam o histórico.

Os registros permanecem append-only, com autor, data e auditoria na criação. A API central `GET /api/support` lista somente dados da empresa autenticada, com 20 registros por página e filtros opcionais por cliente, categoria e texto (relato, nome ou WhatsApp). Os parâmetros são limitados e validados para evitar consultas excessivas.

A interface é responsiva, reutiliza o design system atual do ERP e permite filtrar e pesquisar registros de todos os clientes. O cadastro reutiliza `POST /api/clients/:id/support`, inclusive sua verificação de que o pedido vinculado pertence ao cliente.

## Limites

- Os registros não constituem ainda um sistema de chamados com status, SLA, fila, atribuição ou automação de mensagens; essas regras ainda não estão especificadas.
- Esta entrega não integra WhatsApp/VaxChat/VaxLab nem altera o Módulo 1.
- A tela usa o padrão visual do ERP; aprovação pixel a pixel contra Stitch depende de conferência visual na aplicação publicada.
- Não há migração nem alteração de dados reais. O deploy na VPS permanece separado.

## Testes

`scripts/smoke-support-workspace.ts` é incluído na suíte GitHub e valida página protegida, cadastro auditável, categorias, pesquisa, 23 registros paginados, entradas inválidas e isolamento por empresa. Os testes existentes por cliente também permanecem.
