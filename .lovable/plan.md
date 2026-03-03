

# Status do Plano P0→P2 e Implementação Pendente

## Status atual

| Item | Status | Observação |
|------|--------|-----------|
| **P0.1** Message Buffer cron | ✅ Concluído | setTimeout removido, cron ativo, lock implementado, mensagens desbloqueadas |
| **P0.2** Trava Financeira fallback | ✅ Já implementado | Retry 2x com re-invoke do flow, fallback para `waiting_human` + dept Financeiro, flow state `transferred`, mensagem enviada. Gap intencional: hasFlowContext=true + 2x falha → mantém no fluxo (soberania) |
| **P1.1** Nó create_ticket | ⚠️ **Parcialmente feito** | Frontend do EndNode tem opção `create_ticket` no select, mas `process-chat-flow` **não tem handler** (linhas 2329-2333 tratam apenas `create_lead` com TODO). Nó mid-flow `CreateTicketNode` **não existe** |
| **P1.2** Variáveis/Autocomplete/Warnings | ✅ Já implementado | `variableCatalog.ts` completo: 14 contact vars, 7 conversation vars, order vars, graph traversal, `findOrphanVariables`, `evaluateCondition` com `getVar` fallback chain, 13 condition contact fields + 5 conversation fields |
| **P2.1** Relatório Inbox | ✅ Já implementado | RPC `get_inbox_time_report` com SLA, CSAT, tags, p50/p90, filtros. `InboxTimeTable` + `useInboxTimeReport` funcionais |

## Trabalho restante: P1.1 — Nó create_ticket completo

### 1. Backend: Handler no `process-chat-flow/index.ts`

**EndNode action** (linhas 2329-2333): Adicionar handler para `end_action === 'create_ticket'`:
- Resolver variáveis do `action_data` (subject, description) via `replaceVariables`
- Inserir ticket na tabela `tickets` com: subject, description, category (do action_data), priority default `medium`, status `open`, `source_conversation_id`, `contact_id`
- Idempotency key: `conversation_id + flow_state_id + node_id` para evitar duplicação em retries
- Logar evento no `ai_events`

**Mid-flow CreateTicketNode**: Adicionar novo tipo de nó `create_ticket` no motor:
- Handler no switch principal de tipos de nó
- Cria ticket com campos configuráveis (subject template, description template, category, priority)
- Auto-avança para próximo nó (igual `message`)
- Mesma lógica de idempotência

### 2. Frontend: Componente `CreateTicketNode`

**Novo arquivo**: `src/components/chat-flows/nodes/CreateTicketNode.tsx`
- Visual: ícone Ticket, campos subject/description com suporte a `{{variáveis}}`
- Select de category (enum existente: financeiro, tecnico, bug, outro, devolucao, reclamacao, saque)
- Select de priority (low, medium, high, urgent)
- Badge visual indicando "Criar Ticket"

**Properties panel** no `ChatFlowEditor.tsx`:
- Campos editáveis: subject (com VariableAutocomplete), description (com VariableAutocomplete), category, priority
- Preview das variáveis disponíveis

### 3. Registro do nó

- Adicionar `CreateTicketNode` ao `nodeTypes` no `ChatFlowEditor`
- Adicionar ao index de exports (`nodes/index.ts`)
- Adicionar opção "Criar Ticket" no menu de adição de nós
- Adicionar ao `nodeConfig` com ícone e cor

### 4. Proteção contra duplicidade

Quando autopilot está ativo COM flow ativo, bloquear a tool call `classify_and_resolve_ticket` se o fluxo tem um nó `create_ticket` no caminho. Isso evita que a IA crie ticket duplicado via tool call enquanto o flow já vai criar via nó.

### Impacto
- **Upgrade puro**: Não altera nenhum comportamento existente
- **Sem regressão**: EndNode sem `create_ticket` continua funcionando normalmente
- **Idempotência**: Key composta previne duplicação em retries do cron/buffer

