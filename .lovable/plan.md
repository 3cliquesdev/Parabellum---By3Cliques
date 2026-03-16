

# Correção: Fluxo Manual Bloqueado pelo Master Flow

## Problema

Quando você clica em "Iniciar fluxo manual" após o Master Flow ter transferido para humano, o novo fluxo não inicia porque:

1. **Guarda de `ai_mode` bloqueia**: Após transferência, a conversa fica em modo `waiting_human`. O código rejeita qualquer processamento de fluxo nesse estado — mas não faz exceção para trigger manual.
2. **Estado antigo não é limpo**: O DELETE só remove estados `active`, `waiting_input`, `in_progress`, `cancelled` — mas NÃO remove `transferred` nem `completed`. O Master Flow fica "preso" ali.

## Correção (3 mudanças no mesmo arquivo)

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

### 1. Permitir trigger manual mesmo em `waiting_human`
Na linha ~853, adicionar `&& !manualTrigger` à condição que bloqueia:
```typescript
if ((currentAiMode === 'waiting_human' || ...) && !isTestMode && !manualTrigger) {
```

### 2. Limpar TODOS os estados antigos (incluir `transferred` e `completed`)
Na linha ~1313, expandir o filtro de status no DELETE:
```typescript
.in('status', ['active', 'waiting_input', 'in_progress', 'cancelled', 'transferred', 'completed']);
```

### 3. Resetar ai_mode para autopilot no trigger manual
Após o DELETE (~linha 1319), resetar a conversa para que o novo fluxo funcione:
```typescript
await supabaseClient.from('conversations')
  .update({ ai_mode: 'autopilot', assigned_to: null })
  .eq('id', conversationId);
```

### 4. Deploy da função `process-chat-flow`

