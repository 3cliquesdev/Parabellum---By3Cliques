

# Nova tool `classify_and_resolve_ticket` no Autopilot

## Contexto

Após `close_conversation` encerrar a conversa, a IA precisa documentar/classificar a resolução. Tool separada (Opção A), sem alterar `close_conversation`.

## Schema confirmado (zero migrations necessárias)

- `tickets`: tem `category` (enum), `status` (enum), `internal_note`, `resolved_at`, `source_conversation_id`, `subject`, `description`, `customer_id`, `department_id`
- `conversations`: tem `related_ticket_id`, `customer_metadata`
- `ai_events`: tem `entity_id`, `entity_type`, `event_type`, `model`, `output_json`

## Alterações — único arquivo

### `supabase/functions/ai-autopilot-chat/index.ts`

**1. Adicionar tool na lista (após `close_conversation`, ~linha 5922)**

```typescript
{
  type: 'function',
  function: {
    name: 'classify_and_resolve_ticket',
    description: 'Classifica e registra resolução após encerramento confirmado. Use APÓS close_conversation com customer_confirmed=true.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['financeiro','tecnico','bug','outro','devolucao','reclamacao','saque'] },
        summary: { type: 'string', description: 'Resumo curto da resolução (máx 200 chars)' },
        resolution_notes: { type: 'string', description: 'Detalhes de como foi resolvido' },
        severity: { type: 'string', enum: ['low','medium','high'] },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags descritivas' }
      },
      required: ['category', 'summary', 'resolution_notes']
    }
  }
}
```

**2. Adicionar handler (após handler de `close_conversation`, ~linha 7080)**

Fluxo exato:

1. Parse args
2. Buscar configs: `ai_global_enabled`, `ai_shadow_mode`
3. **Kill switch** → retorna erro, loga `ai_events` com `event_type: 'ai_ticket_classification'`
4. **Guard**: checar `conversation.status === 'closed'` OU `customer_metadata.awaiting_close_confirmation` removido (confirma que close já aconteceu)
5. **Anti-duplicação**: buscar ticket existente por `conversations.related_ticket_id` → se não, buscar por `source_conversation_id = conversationId` → se não, criar novo
6. **Shadow mode** → não executa UPDATE/INSERT em tickets, loga `ai_events` com `shadow_mode: true`, insere `ai_suggestions` com `suggestion_type: 'ticket_classification'`
7. **Execução normal**:
   - Se ticket existente: `UPDATE tickets SET status='resolved', category=X, internal_note=formatted, resolved_at=now()`
   - Se novo: `INSERT INTO tickets (subject, description, status, category, internal_note, source_conversation_id, customer_id, department_id, resolved_at) VALUES (...)`
   - Atualizar `conversations.related_ticket_id` se null
8. **Auditoria**: inserir `ai_events` com `event_type: 'ai_ticket_classification'`, `output_json: { category, summary, severity, tags, ticket_id, action: 'created'|'updated', shadow_mode }`
9. **Retorno**: `assistantMessage = "Ticket classificado como [category] e registrado como resolvido."`

**Formato do `internal_note`:**
```
[AI RESOLVED]
Categoria: {category}
Resumo: {summary}
Resolução: {resolution_notes}
Severidade: {severity || 'N/A'}
Tags: {tags?.join(', ') || 'N/A'}
Conversa: {conversationId}
```

**3. Instrução no system prompt (~linha 5741)**

Adicionar após a linha do `close_conversation`:
```
- classify_and_resolve_ticket: Após encerrar conversa (close_conversation confirmado), classifique e registre a resolução. Use a categoria mais adequada do enum. Escreva summary curto e resolution_notes objetivo.
```

**4. Flag no close (linha ~1726)**

Após o `close-conversation` ser invocado com sucesso, adicionar flag no `customer_metadata`:
```typescript
customer_metadata: {
  ...cleanMeta,
  ai_can_classify_ticket: true,
  ai_last_closed_at: new Date().toISOString(),
  ai_last_closed_by: 'autopilot'
}
```

E no handler de `classify_and_resolve_ticket`, validar `conversation.customer_metadata.ai_can_classify_ticket === true` antes de executar. Limpar flag após execução.

## Guard rails

- Kill switch → bloqueia, loga
- Shadow mode → não altera DB, loga `ai_events` + `ai_suggestions`
- Anti-duplicação → busca ticket existente antes de criar
- Flag guard → só executa se `ai_can_classify_ticket === true`
- Limpa flag após execução (não reclassifica)

## Impacto

- Zero regressão: `close_conversation` e `create_ticket` inalterados
- Tool aditiva — não altera nenhum fluxo existente
- Auditoria completa via `ai_events`

## Atualização do `ai-tools-schema.ts`

Adicionar `classify_and_resolve_ticket` ao schema e ao type `ToolName`.

