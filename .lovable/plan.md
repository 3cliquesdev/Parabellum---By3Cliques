

# Corrigir: Fallback Detector ignora soberania do fluxo

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema identificado

Quando o cliente diz "Fala com atendente" dentro de um nó `ai_response` do Master Flow, a IA gera uma resposta contendo frases como "vou transferir para um atendente". O **Fallback Detector** (Fase 4 do `ai-autopilot-chat`) detecta essa frase e executa um handoff direto — sem verificar se existe `flow_context`.

**O que acontece:**
1. Cliente diz "Fala com atendente"
2. IA gera resposta com "vou chamar um atendente" (ou frase similar)
3. Fallback Detector detecta a frase nos `FALLBACK_PHRASES`
4. Executa handoff direto: `ai_mode = waiting_human`, finaliza flow state como `transferred`
5. **Próximo nó do fluxo NUNCA é executado** → cliente abandonado

**Onde está o bug:** `ai-autopilot-chat/index.ts`, linhas ~7571-7650. O Fallback Detector faz handoff direto sem verificar `flow_context`, ao contrário dos guards de Strict RAG (linha 4102) e Confidence Handoff (linha 4786) que corretamente retornam `flow_advance_needed`.

## Correção

Adicionar o mesmo guard de `flow_context` no Fallback Detector. Quando `flow_context` existe, retornar `flow_advance_needed` em vez de fazer handoff direto, permitindo que o webhook re-invoque `process-chat-flow` com `forceAIExit=true` e avance para o próximo nó do fluxo.

### Mudança no `ai-autopilot-chat/index.ts`

Na Fase 4 (Fallback Detector), após detectar `isFallbackResponse = true`:

```typescript
// ANTES (bug): handoff direto sem verificar flow_context
if (isFallbackResponse) {
  console.log('[ai-autopilot-chat] 🚨 FALLBACK DETECTADO - Executando handoff REAL');
  // ... handoff direto ...
}

// DEPOIS (fix): verificar flow_context primeiro
if (isFallbackResponse) {
  console.log('[ai-autopilot-chat] 🚨 FALLBACK DETECTADO');
  
  // 🆕 GUARD: Se flow_context existe, devolver ao fluxo (soberania)
  if (flow_context) {
    console.log('[ai-autopilot-chat] 🔄 FALLBACK + flow_context → retornando flow_advance_needed');
    
    await supabaseClient.from('ai_quality_logs').insert({
      conversation_id: conversationId,
      contact_id: contact.id,
      customer_message: customerMessage,
      ai_response: assistantMessage,
      action_taken: 'flow_advance',
      handoff_reason: 'fallback_flow_advance',
      confidence_score: 0,
      articles_count: knowledgeArticles.length
    });
    
    return new Response(JSON.stringify({
      status: 'flow_advance_needed',
      reason: 'fallback_detected',
      hasFlowContext: true,
      fallback_message: assistantMessage
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  
  // Sem flow_context → handoff direto (comportamento existente preservado)
  // ... resto do código existente ...
}
```

### Sem risco de regressão
- Guards de Strict RAG e Confidence Handoff continuam inalterados
- Handoff direto para conversas SEM fluxo ativo continua funcionando
- O webhook já tem toda a lógica para processar `flow_advance_needed` e re-invocar `process-chat-flow`
- O `process-chat-flow` já sabe tratar `forceAIExit=true` e avançar ao próximo nó

