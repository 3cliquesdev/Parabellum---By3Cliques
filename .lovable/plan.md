

# Checklist P1.1 — Resultado da Auditoria

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Resultado por Item

| # | Item | Status | Detalhe |
|---|------|--------|---------|
| **A** | Setup (schema) | ✅ | `idempotency_key` (text, unique index), `category`, `priority`, `status`, `subject`, `description`, `source_conversation_id`, `contact_id`, `department_id`, `internal_note` — todos existem |
| **B** | EndNode end_action=create_ticket | ✅ | Handler presente em 2 locais (pós-input L2428 e pós-auto-advance L2620). `replaceVariables` aplicado em subject/description/internal_note |
| **C** | Nó mid-flow create_ticket | ✅ | Handler no auto-advance loop (L2535-2558). Auto-avança igual `message`. `__last_ticket_id` salvo |
| **D** | Idempotência | ✅ | Key `flow:{conv}:{state}:{node}`. Lookup antes de insert + UNIQUE index `tickets_idempotency_key_key` |
| **E** | Log ai_events | ✅ | `event_type='flow_create_ticket'` com ticket_id, category, priority, node_id, department_id |
| **F** | Autopilot anti-duplicidade | ✅ | Guard em `classify_and_resolve_ticket`: query `chat_flow_states` com status `in_progress/active/waiting_input`. Se ativo → bloqueia + loga em ai_events |
| **G** | Frontend visual | ✅ | Node na sidebar "Ações", badges categoria/prioridade, VariableAutocomplete em subject/description/internal_note, Switch use_collected_data. Mesmo para EndNode config |

## Bug Encontrado: coluna `metadata` não existe

**Severidade: Média** — O `createTicketFromFlow` inclui `metadata` (com `flow_state_id`, `node_id`, `collected_data` snapshot) no payload de insert, mas a tabela `tickets` **não tem coluna `metadata`** (só tem `attachments` como jsonb).

**Impacto**: Dependendo do comportamento do Supabase SDK:
- Se ignora colunas desconhecidas → ticket é criado mas sem metadata (dados de auditoria perdidos)
- Se rejeita → insert falha e `createTicketFromFlow` retorna null (non-blocking, fluxo continua mas ticket não é criado)

**Fix necessário**: Criar coluna `metadata jsonb default '{}'::jsonb` na tabela tickets via migration.

## Plano de correção

1. **Migration**: `ALTER TABLE tickets ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;`
2. Sem impacto em tickets existentes (default `{}`)
3. Após isso, o `use_collected_data=true` funciona corretamente (snapshot salvo em `metadata.collected_data`)

## Resumo

- **7 de 7 itens do checklist passam no código** — lógica correta
- **1 bug de schema** impede `metadata` de ser persistido (e possivelmente impede criação do ticket inteiro)
- Fix: 1 migration simples

