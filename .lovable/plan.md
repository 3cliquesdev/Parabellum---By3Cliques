

# Documento do Sistema de Distribuição do Inbox

## Objetivo
Gerar um documento DOCX profissional e completo documentando toda a arquitetura do sistema de distribuição de conversas do Inbox, incluindo:

- Visão geral da arquitetura
- Componentes (Edge Functions, tabelas, triggers)
- Fluxo completo de uma conversa (do WhatsApp ao agente)
- Algoritmo Round-Robin Least-Loaded
- Preferred Agent routing
- Mecanismos de resiliência (reconciliação, requeue, escalation)
- Roles elegíveis
- Diagrama de estados (ASCII)
- Configurações e limites

## Fontes de Dados (código auditado)
| Componente | Arquivo |
|---|---|
| Dispatcher principal | `dispatch-conversations/index.ts` (862 linhas) |
| Transição de estado | `transition-conversation-state/index.ts` (235 linhas) |
| Distribuição on-agent-online | `distribute-pending-conversations/index.ts` (341 linhas) |
| Redistribuição em lote | `bulk-redistribute/index.ts` (270 linhas) |
| Auto-handoff (sentimento) | `auto-handoff/index.ts` (245 linhas) |
| Cron trigger | `cron-process-queue/index.ts` |
| Distribuição de clientes | `distribute_client_to_consultant` (SQL function) |
| Transfer manual | `useTransferConversation.tsx` |
| Bulk distribute UI | `InboxBulkDistributeBar.tsx` |

## Entrega
- Arquivo DOCX em `/mnt/documents/sistema-distribuicao-inbox.docx`
- Gerado via `docx-js` com formatação profissional
- Seções: Visão Geral, Arquitetura, Componentes, Fluxo de Estados, Algoritmo, Roles, Resiliência, Configurações

## Execução
1. Criar script JS com `docx` para gerar o documento
2. Validar o DOCX
3. Entregar via `presentation-artifact`

