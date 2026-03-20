

# Fix: Conversas `waiting_human` Nunca São Encerradas Fora do Horário

## Diagnóstico

**48 conversas** estão presas em `waiting_human` agora (46 no Suporte, 2 no Suporte Sistema). Elas acumulam dia após dia porque:

1. **`human_auto_close_minutes` é NULL em TODOS os departamentos** — Stage 4 do `auto-close-conversations` nunca executa
2. **`auto-close-conversations` não tem nenhuma etapa para fechar conversas `waiting_human` fora do horário** — ele só fecha conversas `autopilot` (Stages 2, 3, 3b) ou `awaiting_close_confirmation` (Stage 3.5)
3. **`dispatch-conversations`** tenta aplicar tag after-hours, mas usa `contact_tags` em vez de `conversation_tags` (bug na linha 899)

```text
Fluxo atual:
  Cliente → IA → handoff → waiting_human → ❌ NINGUÉM FECHA
  
  auto-close Stage 3: ai_mode='autopilot' only → SKIP
  auto-close Stage 4: human_auto_close_minutes=NULL → SKIP
  dispatch escalation: só jobs escalados → nem sempre existe
```

## Correções

### 1. `auto-close-conversations/index.ts` — Nova Stage 6: After-Hours Cleanup

Adicionar uma nova etapa APÓS Stage 5 que:
- Verifica se está fora do horário comercial (`!businessHoursInfo.within_hours`)
- Se sim, busca todas as conversas `waiting_human` que estão abertas há mais de 10 minutos
- Aplica a tag configurada `after_hours_tag_id` ("9.05 Atendimento Fora do Horario") em `conversation_tags`
- Envia mensagem de encerramento com template `after_hours_handoff`
- Fecha a conversa com `closed_reason: 'after_hours_no_agent'`

```typescript
// ETAPA 6: After-Hours — fechar waiting_human sem agentes
if (!businessHoursInfo.within_hours) {
  // Buscar after_hours_tag_id da config
  // Buscar conversas open + waiting_human + last_message_at > 10min
  // Para cada: enviar mensagem, aplicar tag, fechar
}
```

### 2. `dispatch-conversations/index.ts` — Fix tag table (linha 899)

Trocar `contact_tags` → `conversation_tags`:
```typescript
// ANTES (ERRADO):
await supabase.from('contact_tags').upsert(...)

// DEPOIS (CORRETO):
await supabase.from('conversation_tags').upsert(
  { conversation_id: job.conversation_id, tag_id: msgRow.after_hours_tag_id },
  { onConflict: 'conversation_id,tag_id' }
);
```

### 3. Deploy

Redeployar `auto-close-conversations` e `dispatch-conversations`.

### Resultado

- Conversas `waiting_human` fora do horário serão fechadas automaticamente com a tag "9.05 Atendimento Fora do Horario"
- As 48 conversas atuais serão fechadas na próxima execução do cron fora do horário
- `dispatch-conversations` aplicará a tag corretamente em `conversation_tags`

