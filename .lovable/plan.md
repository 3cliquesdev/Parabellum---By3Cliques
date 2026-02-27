

# Fix: Trava Financeira no `ai-autopilot-chat` não avança o fluxo

## Diagnóstico da conversa #9B65FDF7

**O que aconteceu:**
1. Contato enviou mensagem com "pagamento" enquanto no nó `ia_entrada` (ai_response)
2. `process-chat-flow` retornou `aiNodeActive: true` → webhook chamou `ai-autopilot-chat`
3. `ai-autopilot-chat` detectou "pagamento" no padrão financeiro → setou `ai_mode = waiting_human` e retornou `financialBlocked: true`
4. **Porém**, `ai-autopilot-chat` NÃO atualizou o `chat_flow_states` para avançar o nó
5. O flow state ficou preso em `ia_entrada` com status `active`
6. Todas as mensagens seguintes ("???", "??") entram em `process-chat-flow` que vê `ai_mode = waiting_human` → retorna `skipAutoResponse` → fluxo travado para sempre

**Causa raiz:** A trava financeira no `ai-autopilot-chat` (linhas 1300-1352) seta `waiting_human` e retorna early, mas **não avança o flow state para o próximo nó**. A responsabilidade de avançar deveria estar no `process-chat-flow`, que já tem essa lógica (linhas 1170-1261), mas o `ai-autopilot-chat` "curto-circuita" antes.

## Solução

Existem duas opções. A mais segura é **mover a interceptação financeira para dentro do `process-chat-flow`**, que já tem a lógica de `findNextNode`. Porém isso é uma refatoração grande.

A solução mais cirúrgica: **quando `ai-autopilot-chat` retorna `financialBlocked: true`, o webhook deve notificar o `process-chat-flow` para avançar o nó**.

### Opção escolhida: Fix no webhook (`meta-whatsapp-webhook`)

**Arquivo:** `supabase/functions/meta-whatsapp-webhook/index.ts`

Após receber resposta do `ai-autopilot-chat` com `financialBlocked: true`, fazer uma segunda chamada ao `process-chat-flow` com flag `forceAdvanceFromAI: true` para que ele avance o flow state.

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

Adicionar handler para `forceAdvanceFromAI: true` que:
1. Busca o flow state ativo
2. Deleta `collectedData.__ai`
3. Chama `findNextNode` a partir do nó atual
4. Atualiza o flow state para o próximo nó

### Alternativa mais simples

Diretamente no `ai-autopilot-chat`, quando `financialBlocked` é detectado, **também completar/cancelar o flow state** para que o fluxo não fique órfão:

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (linhas ~1308-1318)

Adicionar após o update de `ai_mode`:
```typescript
// Avançar flow state para próximo nó (evitar fluxo órfão)
const { data: activeFlowState } = await supabaseClient
  .from('chat_flow_states')
  .select('id, flow_id, current_node_id, collected_data')
  .eq('conversation_id', conversationId)
  .in('status', ['active', 'waiting_input', 'in_progress'])
  .order('started_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (activeFlowState) {
  // Marcar o flow state como completado/transferido para desbloquear
  await supabaseClient
    .from('chat_flow_states')
    .update({
      status: 'transferred',
      completed_at: new Date().toISOString(),
    })
    .eq('id', activeFlowState.id);
  console.log('[ai-autopilot-chat] 🔒 Flow state finalizado (trava financeira):', activeFlowState.id);
}
```

### Impacto
- Zero regressão: apenas adiciona finalização do flow state quando trava financeira ativa
- Conversas futuras com "pagamento" no nó AI terão o fluxo encerrado corretamente
- A conversa será liberada para atendimento humano sem flow state órfão

### Fix imediato para #9B65FDF7
- Atualizar manualmente o flow state `8d52149c-ddcf-4e76-96b1-ff676a9a6f5b` para `status = 'transferred'`

