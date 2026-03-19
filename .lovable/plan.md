

# Auditoria Conversa #58E1D655 — IA sobrescreveu atendente humano

## Diagnóstico

### Timeline crítica
```text
17:20:40  "Transferindo para um atendente..." (handoff)
17:24:06  "Transferindo para um atendente..." (2o handoff)
18:02:09  Agente Miguel envia "Boa tarde!" ← HUMANO ASSUMIU
18:02:24  Cliente responde "Ola"
18:02:26  IA RESPONDE COM MENU "Desculpe, não entendi..." ← BUG
18:02:35  "Transferindo para um atendente..." (3o handoff)
18:26:49  Agente Miguel tenta de novo "Boa tarde!"
18:28:18  Cliente responde "Boa tarde"
18:28:20  IA RESPONDE COM MENU DE NOVO ← BUG
```

O agente assumiu a conversa TRÊS VEZES e a IA retomou o controle TODAS as vezes.

### Causa raiz: Soberania do Fluxo ignora agente atribuído

Em `process-chat-flow/index.ts` linhas 855-870, existe uma regra de "soberania do fluxo":

```
SE ai_mode é copilot/waiting_human/disabled
  E existe flow state ativo (waiting_input/active/in_progress)
  → IGNORAR ai_mode, restaurar para autopilot e processar o fluxo
```

O problema: essa regra **NÃO verifica se há agente atribuído**. Mesmo com Miguel assumido (`assigned_to = 0d6766cc`), se existe um `chat_flow_state` com status `waiting_input` residual, o sistema:
1. Ignora que o agente está atendendo
2. Força `ai_mode` de volta para `autopilot`
3. Processa a mensagem do cliente como input do menu
4. "Ola" não bate com nenhuma opção → "Desculpe, não entendi..."

O flow state residual (`8cea1827`, node `node_menu_assunto`, status `waiting_input`) ficou "vivo" porque nunca foi cancelado durante os handoffs.

### Por que o flow state não foi cancelado?

O `take_control_secure` RPC FAZ DELETE de flow states ativos (linha 66-68). Porém, o agente pode ter usado o auto-takeover (enviar mensagem direto) em vez do botão "Assumir Controle", ou o flow state foi re-criado após o take_control pela re-invocação do `process-chat-flow` no webhook.

## Plano de Correção

### Fix 1: Soberania do fluxo deve respeitar agente atribuído
**Arquivo:** `supabase/functions/process-chat-flow/index.ts` (linhas 855-870)

Adicionar verificação de `assigned_to` ANTES de aplicar a soberania:

```typescript
if (activeFlowCheck) {
  // 🛡️ NOVO: Se há agente atribuído, o humano tem prioridade sobre o fluxo
  if (convState?.assigned_to) {
    console.log(`[process-chat-flow] 🛡️ AGENTE ATIVO: assigned_to=${convState.assigned_to} — cancelando fluxo residual`);
    // Cancelar flow state residual
    await supabaseClient.from('chat_flow_states')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', activeFlowCheck.id);
    
    return new Response(JSON.stringify({
      useAI: false,
      aiNodeActive: false,
      skipAutoResponse: true,
      reason: `agent_active_flow_cancelled`,
      message: `Agente atribuído - fluxo residual cancelado`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  
  // Sem agente → manter soberania do fluxo (comportamento atual)
  console.log(`[process-chat-flow] 🔓 SOBERANIA DO FLUXO: ai_mode=${currentAiMode} mas fluxo ativo...`);
  await supabaseClient.from('conversations')
    .update({ ai_mode: 'autopilot' })
    .eq('id', conversationId);
}
```

### Fix 2: Auto-takeover deve cancelar flow states
**Arquivo:** `src/hooks/useSendMessageInstant.tsx`

Quando o agente envia uma mensagem (auto-takeover), adicionar DELETE dos flow states ativos na mesma operação:

```typescript
// Após o INSERT da mensagem, cancelar flow states ativos
await supabase.from('chat_flow_states')
  .update({ status: 'cancelled', completed_at: new Date().toISOString() })
  .eq('conversation_id', conversationId)
  .in('status', ['waiting_input', 'active', 'in_progress']);
```

### Arquivos a alterar
1. `supabase/functions/process-chat-flow/index.ts` — Fix 1 (soberania respeitar agente)
2. `src/hooks/useSendMessageInstant.tsx` — Fix 2 (auto-takeover cancela fluxos)

