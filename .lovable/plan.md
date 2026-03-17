

# Bug Fix: IA responde mesmo após agente assumir controle

## Causa raiz identificada

Encontrei o problema e confirmei com dados reais. São **806 conversas afetadas** agora mesmo.

### O que acontece:

1. Agente clica "Assumir Controle" → `take_control_secure` muda `ai_mode` para `copilot`
2. Cliente envia mensagem → webhook chama `process-chat-flow`
3. `process-chat-flow` verifica `ai_mode = copilot` e deveria bloquear...
4. **MAS** encontra um registro ativo na tabela `chat_flow_states` (status `waiting_input`/`active`)
5. A lógica de "Soberania do Fluxo" (linha 925-930) **sobrescreve** `ai_mode` de volta para `autopilot`
6. A IA responde ao cliente como se nenhum agente estivesse na conversa

O problema está em **dois lugares**:

**1. `take_control_secure` (RPC)** — Não limpa os `chat_flow_states` ao assumir controle
**2. `process-chat-flow` (linha 925)** — A "Soberania do Fluxo" não verifica se há agente atribuído antes de sobrescrever o copilot

## Correções

### Correção 1 — RPC `take_control_secure`
Adicionar limpeza dos flow states quando o agente assume:

```sql
-- Após o UPDATE conversations SET ai_mode = 'copilot'...
UPDATE chat_flow_states
SET status = 'transferred', completed_at = NOW()
WHERE conversation_id = p_conversation_id
  AND status IN ('waiting_input', 'active', 'in_progress');
```

### Correção 2 — `process-chat-flow` guard (defesa em profundidade)
Na verificação de "Soberania do Fluxo" (linha 925), adicionar condição: se `assigned_to` está preenchido (agente humano), **respeitar o copilot** e não restaurar autopilot:

```typescript
if (activeFlowCheck) {
  // 🆕 Se tem agente atribuído, o humano tem prioridade sobre o fluxo
  if (convState?.assigned_to && currentAiMode === 'copilot') {
    // Cancelar o flow state residual em vez de restaurar autopilot
    await supabaseClient.from('chat_flow_states')
      .update({ status: 'transferred', completed_at: new Date().toISOString() })
      .eq('id', activeFlowCheck.id);
    // Retornar skipAutoResponse como se não houvesse fluxo
    return skipResponse;
  }
  // Caso sem agente: manter soberania do fluxo (comportamento atual)
  ...
}
```

### Correção 3 — Limpar os 806 estados residuais existentes
Migration SQL para corrigir dados atuais:

```sql
UPDATE chat_flow_states
SET status = 'transferred', completed_at = NOW()
WHERE status IN ('waiting_input', 'active', 'in_progress')
  AND conversation_id IN (
    SELECT id FROM conversations 
    WHERE ai_mode IN ('copilot', 'disabled') 
       OR assigned_to IS NOT NULL
  );
```

## Arquivos alterados
1. **Migration SQL** — Atualizar RPC `take_control_secure` + limpar dados existentes
2. **`supabase/functions/process-chat-flow/index.ts`** — Guard de defesa na Soberania do Fluxo

## Impacto
- Resolve o bug para **todas** as conversas futuras (RPC fix)
- Corrige as 806 conversas afetadas agora (data migration)  
- Defesa em profundidade no motor de fluxos (guard fix)
- Zero impacto em conversas em autopilot legítimo

