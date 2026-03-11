

# Plano: Edge Function `transition-conversation-state`

## Resumo
Criar uma edge function centralizada que é a única fonte da verdade para mudanças de estado de conversas, e integrar nos dois chamadores principais (`auto-handoff` e `process-chat-flow`).

## Tarefas

### 1. Criar `supabase/functions/transition-conversation-state/index.ts`
Edge function conforme o prompt do usuário, com state machine, gerenciamento de dispatch jobs, e logging em `ai_events`. Suporta 7 tipos de transição: `handoff_to_human`, `assign_agent`, `unassign_agent`, `engage_ai`, `set_copilot`, `update_department`, `close`.

### 2. Atualizar `supabase/config.toml`
Adicionar:
```toml
[functions.transition-conversation-state]
verify_jwt = false
```

### 3. Atualizar `supabase/functions/auto-handoff/index.ts`
Substituir as linhas 138-177 (dois blocos: fallback com busca dinâmica de dept + update direto após routing) por uma única chamada:
```typescript
await supabaseClient.functions.invoke('transition-conversation-state', {
  body: {
    conversationId,
    transition: 'handoff_to_human',
    reason: handoffReason,
    metadata: { routing_result: routingResult, sentiment: handoffReason }
  }
});
```
O roteamento (`route-conversation`) continua sendo chamado antes — só o update de estado é centralizado.

### 4. Atualizar `supabase/functions/process-chat-flow/index.ts`
Substituir os dois blocos de update direto em transfer nodes:

**Bloco 1** (~linhas 2802-2810): Substituir `convUpdatePayload` + `conversations.update` por `fetch()` para `transition-conversation-state` com `transition: 'handoff_to_human'`.

**Bloco 2** (~linhas 3055-3063): Mesmo padrão para o transfer node após message chain.

Ambos usam `fetch()` direto (já padrão no process-chat-flow) com `SUPABASE_SERVICE_ROLE_KEY` no header.

### 5. Atualizar `.lovable/plan.md`
Documentar como FIX 14.

## Notas Técnicas
- `conversation_dispatch_jobs` usa `upsert` com `onConflict: 'conversation_id'` — requer unique constraint (já existe)
- O `route-conversation` no auto-handoff NÃO é removido — ele faz atribuição de agente; a transição centralizada cuida apenas do estado
- Os `return new Response(...)` no process-chat-flow (transfer/departmentId) permanecem inalterados — só o `.update()` da conversa muda

