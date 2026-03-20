

## Auditoria Regressiva Completa — Conversa #AFDAE1C6 (Ronildo Oliveira)

### Linha do Tempo

| Hora | Evento | Status |
|------|--------|--------|
| 00:58:17 | "Boa noite" → Menu produtos | ✅ OK |
| 01:00:04 | "1" (Drop Nacional) → Menu departamentos | ✅ OK |
| 01:00:14 | "2" (Financeiro) → **"Não encontrei informações"** | ❌ BUG A |
| 01:01:13 | "Oi" → (48s delay) Saudação proativa | ✅ OK (lento) |
| 01:02:20 | "Quero sacar" → OTP verificação | ✅ OK |
| 01:03:40 | "693909" (OTP) → **"Código validado! Como posso te ajudar?"** | ❌ BUG D |
| 01:05:56 | "Era para vim a mensagem já pedindo os dados do Pix" | — reclamação |
| 01:07:26 | IA → **"Pode me informar o e-mail utilizado na compra?"** | ❌ BUG E |

### Bugs Identificados — 5 problemas

---

**BUG A — skipInitialMessage AINDA falha para seleção "2" (REGRESSÃO)**
A seleção "2" no menu de departamentos gera "Não encontrei informações" (Strict RAG) em vez de saudação proativa. O deploy das correções foi confirmado nos logs — skipInitialMessage funciona para OUTRAS conversas (log mostra conversa 98ab6b41 com skipInitialMessage=true bem-sucedido). Possível que o batching não esteja propagando o flag para o buffer ou a `flow_context` não tem `stateId`.

---

**BUG D — Pós-OTP genérico: "Como posso te ajudar?" em vez de coletar dados PIX (CRÍTICO)**
Linha 6447-6456 do `ai-autopilot-chat`: após OTP validado com sucesso, busca `recentWithdrawal` no histórico para detectar intent "saque". O regex `/quero\s+sacar|saque|sacar|carteira|retirar/i` deveria casar com "Quero sacar" (mensagem do cliente). Porém, o resultado foi a resposta genérica (linha 6456), indicando que a busca falhou.

**Causa provável**: O OTP foi processado pelo `process-chat-flow` (OTP determinístico, linhas 3298-3339), que valida o código e retorna `useAI: true`. Depois, o webhook chama `ai-autopilot-chat` com `customerMessage="693909"`. Neste segundo call, o `hasAwaitingOTP` pode estar `false` (limpo por process-chat-flow via DB update), fazendo `shouldValidateOTP=false`. A mensagem "693909" então passa pelo fluxo normal da LLM, que gera "Código validado com sucesso..." baseado no contexto conversacional. O bloco determinístico de OTP (linha 6422) NÃO executa, logo a lógica de `recentWithdrawal` (linha 6447) NÃO roda.

**Fix**: Adicionar detecção de intent pós-OTP FORA do bloco `shouldValidateOTP`. Quando `hasRecentOTPVerification=true` e o histórico contém intent de saque, sobrescrever a resposta da LLM com o template de coleta de dados PIX.

---

**BUG E — IA pede email após OTP verificado (CRÍTICO)**
Após OTP validado, o customer_metadata tem `last_otp_verified_at: 2026-03-20T01:04:06`. Porém:
- `collected_data` mostra `customer_validated: false` e **NÃO tem** `__ai_otp_verified`
- O OTP sync (linha 6122-6173) requer `flow_context.stateId`

**Causa raiz**: O `process-chat-flow` na resposta `stayOnNode` (linha 3910-3942) **NÃO inclui `stateId`** no payload. O webhook constrói `flow_context.stateId` de `(flowData).debug?.stateId || (flowData).stateId` (linha 1284) — ambos são `null`. Resultado: `flow_context.stateId` = `null` → o sync OTP em `ai-autopilot-chat` (linha 6488: `if (flow_context?.stateId)`) é silenciosamente ignorado.

Sem `__ai_otp_verified` no collected_data, na próxima mensagem do cliente, a IA não sabe que OTP foi verificado → prompt financeiro diz "BLOQUEIO: Cliente NÃO verificou identidade" → IA pede email.

**Fix**: Adicionar `stateId: activeState.id` ao response JSON do `stayOnNode` (linha 3910-3942 no `process-chat-flow`).

---

**BUG F — `category: 'financial'` no guard determinístico de saque (DUPLICATA)**
Linha 6280: `category: 'financial'` — valor inválido. O fix anterior corrigiu na linha 7956 mas **não corrigiu** nesta segunda instância. Mesma causa, mesmo impacto: ticket sem mapeamento de departamento.

**Fix**: Mudar para `category: 'financeiro'` na linha 6280.

---

**BUG G — WhatsApp Evolution API no guard de saque (DUPLICATA)**
Linha 6290-6291: usa `whatsapp_instances` query (Evolution) em vez de `getWhatsAppInstanceForConversation`. Conversas Meta API não recebem a confirmação de ticket. O fix anterior corrigiu na linha 7965 mas não aqui.

**Fix**: Substituir por `getWhatsAppInstanceForConversation` + `sendWhatsAppMessage`.

---

### Plano de Correção — 4 edições

**Edição 1: `process-chat-flow/index.ts` ~L3910 — Incluir stateId no stayOnNode**
Adicionar `stateId: activeState.id` no JSON de resposta para que o webhook propague para `flow_context.stateId` no autopilot.
```typescript
return new Response(
  JSON.stringify({
    useAI: true,
    aiNodeActive: true,
    stayOnNode: true,
    stateId: activeState.id,  // ← ADICIONAR
    nodeId: currentNode.id,
    // ... resto igual
  }),
```

**Edição 2: `ai-autopilot-chat/index.ts` ~L6280 — Corrigir category**
```typescript
category: 'financeiro'  // era 'financial'
```

**Edição 3: `ai-autopilot-chat/index.ts` ~L6289-6291 — Corrigir WhatsApp**
Substituir query Evolution por helper unificado:
```typescript
if (responseChannel === 'whatsapp' && contact?.phone && conversation) {
  try {
    const whatsappResultSaque = await getWhatsAppInstanceForConversation(
      supabaseClient, conversationId, contact, conversation
    );
    if (whatsappResultSaque) {
      await sendWhatsAppMessage(
        supabaseClient, whatsappResultSaque,
        contact.phone, saqueResponse,
        conversationId, contact.whatsapp_id
      );
    }
  } catch (sendErr) {
    console.error('[ai-autopilot-chat] ❌ Saque WhatsApp send failed:', sendErr);
  }
}
```

**Edição 4: `ai-autopilot-chat/index.ts` — Intent de saque pós-OTP fora do bloco shouldValidateOTP**
Após a barreira OTP (linha ~6305), adicionar guard que detecta intent de saque no histórico quando OTP foi recentemente verificado mas a LLM ainda não coletou dados:
```typescript
// GUARD: Pós-OTP intent detection — se OTP verificado recentemente e intent de saque
// no histórico, enviar template de coleta PIX em vez de genérico
if (hasRecentOTPVerification && !looksLikeSaqueData) {
  const historyUserMsgs = messageHistory
    .filter((m: any) => m.role === 'user')
    .slice().reverse().slice(0, 8);
  const hasSaqueIntent = historyUserMsgs.some((m: any) => 
    /quero\s+sacar|saque|sacar|carteira|retirar|retirada/i.test(m.content)
  );
  const otp_reason = (conversationMetadata as any)?.otp_reason;
  
  if (hasSaqueIntent || otp_reason === 'withdrawal') {
    // Verificar se já recebeu template de coleta (evitar duplicata)
    const recentCollectionMsg = messageHistory
      .filter((m: any) => m.role === 'assistant')
      .slice().reverse().slice(0, 3)
      .some((m: any) => /chave\s*PIX|Nome\s*completo.*Tipo.*PIX/i.test(m.content));
    
    if (!recentCollectionMsg) {
      const pixCollectResponse = `✅ **Identidade confirmada!**\n\nOlá ${contactName}! Para processar seu saque, me envie os dados abaixo:\n\n📋 **Nome completo:** [seu nome conforme cadastro]\n🔑 **Tipo da chave PIX:** [CPF / E-mail / Telefone / Chave Aleatória]\n🔐 **Chave PIX:** [sua chave completa]\n💰 **Valor:** [R$ X,XX ou "valor total da carteira"]`;
      
      // Salvar e enviar
      const { data: savedMsg } = await supabaseClient.from('messages').insert({
        conversation_id: conversationId, content: pixCollectResponse,
        sender_type: 'user', is_ai_generated: true, channel: responseChannel
      }).select().single();
      
      if (responseChannel === 'whatsapp' && contact?.phone && conversation) {
        const wr = await getWhatsAppInstanceForConversation(supabaseClient, conversationId, contact, conversation);
        if (wr) await sendWhatsAppMessage(supabaseClient, wr, contact.phone, pixCollectResponse, conversationId, contact.whatsapp_id);
      }
      
      return new Response(JSON.stringify({
        response: pixCollectResponse, messageId: savedMsg?.id,
        debug: { reason: 'post_otp_saque_intent_collect_pix' }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
}
```

**Deploy**: `ai-autopilot-chat` + `process-chat-flow`

---

### Resultado Esperado
- **BUG A**: stateId propagado → melhor diagnóstico. O skipInitialMessage já funciona para outras conversas; precisa monitorar.
- **BUG D**: Intent de saque detectado pós-OTP → template de coleta PIX enviado imediatamente
- **BUG E**: stateId no stayOnNode → OTP sync para collected_data funciona → IA sabe que OTP foi verificado
- **BUG F/G**: Ticket categorizado corretamente + WhatsApp Meta funciona no guard de saque

