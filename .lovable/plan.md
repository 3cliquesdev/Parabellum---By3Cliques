

## Auditoria Regressiva — Conversa #EEFFF1DD (Ronildo Oliveira)

### Linha do Tempo

| Hora | Evento | Status |
|------|--------|--------|
| 01:20:42 | "Boa noite" → Menu produtos | ✅ OK |
| 01:21:15 | "1" (Drop Nacional) → Menu departamentos | ✅ OK |
| 01:21:25 | "2" (Financeiro) → **NENHUMA resposta da IA** | ❌ BUG A |
| 01:22:20 | "Quero sacar o valor da minha conta estou parando com 9 Drop" → **NENHUMA resposta** | ❌ BUG B+C+D |
| 01:30:12 | Auto-close por inatividade | ⚠️ Consequência |

**O cliente NUNCA recebeu uma única resposta da IA nesta conversa.**

---

### Bugs Identificados — 4 problemas

**BUG A — Saudação proativa falhou silenciosamente (CRÍTICO)**
O webhook detectou `skipInitialMessage=true` e chamou `ai-autopilot-chat` com `customerMessage: ""` às 01:21:27. Porém, NENHUM log do autopilot aparece para essa chamada — nenhuma mensagem de saudação foi salva ou enviada. O fetch para o autopilot falhou silenciosamente (possível timeout ou race condition — o `continue` no webhook impede retry).

**Fix**: Adicionar fallback local no webhook. Se a chamada ao autopilot falhar, enviar uma saudação padrão da persona diretamente via WhatsApp, sem depender da LLM.

**BUG B — Strict RAG intercepta pedidos de saque/financeiros (CRÍTICO)**
"Quero sacar o valor da minha conta..." não é dados estruturados (não tem "campo: valor" x3), então o bypass do Strict RAG NÃO ativou. O Strict RAG rodou → GPT-5 retornou resposta VAZIA → fallthrough para fluxo padrão. Isso adiciona ~5s de latência desnecessária e polui o contexto.

**Fix**: Adicionar bypass do Strict RAG para mensagens com intent financeiro explícito (`isFinancialAction` ou `isWithdrawalRequest`). Essas mensagens precisam das tools da LLM principal.

**BUG C — Guard pós-OTP não verifica mensagem atual (CRÍTICO)**
O guard em L6323-6362 busca intent de saque apenas no `messageHistory` (mensagens ANTERIORES). Numa conversa nova onde "Quero sacar" é a primeira mensagem real, o `messageHistory` só contém "Boa noite", "1", "2" — nenhum match. O `customerMessage` atual NÃO é verificado.

**Fix**: Incluir `customerMessage` na verificação de intent: `hasSaqueIntent = historyUserMsgs.some(...) || /quero\s+sacar|saque|.../i.test(customerMessage)`

**BUG D — LLM principal silenciosamente falhou (CRÍTICO)**
Após Strict RAG fallthrough, a LLM principal foi chamada mas NENHUMA resposta foi salva. O `interaction_count` ficou em 1, nenhuma mensagem de resposta existe. O autopilot provavelmente crashou durante a chamada LLM (timeout do edge function ou erro não capturado). A chamada `callAIWithFallback` no timestamp 01:23:04 não tem logs subsequentes de resposta.

**Fix**: Adicionar try/catch global mais robusto com fallback que SEMPRE envia uma mensagem ao cliente, mesmo em caso de erro total da LLM. Atualmente o catch existe mas pode não estar capturando todos os cenários (ex: timeout do Deno).

---

### Plano de Correção — 5 edições

**Edição 1: `ai-autopilot-chat/index.ts` ~L4948 — Bypass Strict RAG para ações financeiras**
```typescript
// ANTES da condição do Strict RAG, adicionar check
const isFinancialBypass = isFinancialAction || isWithdrawalRequest;
if (isFinancialBypass) {
  console.log('[ai-autopilot-chat] 💰 Ação financeira detectada — BYPASS Strict RAG');
}

if (isStrictRAGMode && !isOperationalTopic && !isGreetingBypass 
    && !looksLikeStructuredData && !isFinancialBypass  // ← ADICIONAR
    && OPENAI_API_KEY && knowledgeArticles.length > 0) {
```

**Edição 2: `ai-autopilot-chat/index.ts` ~L6327 — Guard pós-OTP inclui mensagem atual**
```typescript
const hasSaqueIntent = historyUserMsgs.some((m: any) => 
  /quero\s+sacar|saque|sacar|carteira|retirar|retirada/i.test(m.content)
) || /quero\s+sacar|saque|sacar|carteira|retirar|retirada/i.test(customerMessage);
// ↑ VERIFICAR TAMBÉM a mensagem atual, não só o histórico
```

**Edição 3: `meta-whatsapp-webhook/index.ts` ~L1203-1210 — Fallback de saudação quando autopilot falha**
Dentro do catch/error handling da chamada proativa:
```typescript
if (!greetResponse.ok) {
  console.error("[meta-whatsapp-webhook] ❌ Proactive greeting error:", await greetResponse.text());
  // FALLBACK: Enviar saudação padrão diretamente via WhatsApp
  try {
    const fallbackGreeting = "Olá! Sou a assistente virtual da 3Cliques. Posso te ajudar com informações financeiras, saques, reembolsos e dúvidas. Como posso te ajudar?";
    await supabaseClient.from('messages').insert({
      conversation_id: conversation.id, content: fallbackGreeting,
      sender_type: 'user', is_ai_generated: true, channel: 'whatsapp'
    });
    // Enviar via WhatsApp
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-meta-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ instanceId: instance.id, to: contact.phone, message: fallbackGreeting })
    });
  } catch (fbErr) {
    console.error("[meta-whatsapp-webhook] ❌ Fallback greeting also failed:", fbErr);
  }
}
```

**Edição 4: `ai-autopilot-chat/index.ts` — Proteção pós-LLM para garantir resposta**
Após a chamada da LLM principal, se `rawAIContent` estiver vazio E nenhuma tool_call foi feita, enviar uma resposta genérica do contexto do fluxo em vez de retornar silenciosamente:
```typescript
// Se LLM retornou vazio e sem tool_calls, usar fallback do fluxo
if (!rawAIContent && !toolCalls.length) {
  const fallbackMsg = flowFallbackMessage || flowObjective 
    || "Como posso te ajudar hoje?";
  // Salvar e enviar fallbackMsg
}
```

**Edição 5: `ai-autopilot-chat/index.ts` — Melhorar o prompt de saudação proativa**
Atualizar a mensagem de substituição do `customerMessage` vazio (L1520) para incluir instruções mais claras sobre o fluxo:
```typescript
customerMessage = `[SYSTEM: O cliente acabou de chegar neste atendimento pelo menu (${flow_context?.node_id || 'financeiro'}). 
Apresente-se brevemente, mencione suas habilidades no escopo deste atendimento. 
Se for um tema financeiro, pergunte se é uma dúvida ou se precisa de uma ação (saque, reembolso, etc). 
Se o cliente indicar ação financeira, informe que precisará verificar a identidade.]`;
```

**Deploy**: `ai-autopilot-chat` + `meta-whatsapp-webhook`

---

### Resultado Esperado (fluxo completo desejado)
1. ✅ IA se apresenta e fala suas habilidades
2. ✅ Se financeiro → desambigua (dúvida vs ação)
3. ✅ Se ação (saque) → pede OTP
4. ✅ OTP validado → coleta dados PIX
5. ✅ Dados recebidos → cria ticket → informa número + protocolo
6. ✅ "Posso te ajudar com algo mais?" → se não → encerra + tag "saque de saldo"

Os passos 3-6 já estão implementados nos fixes anteriores (guard pós-OTP, create_ticket, encerramento). Os fixes desta rodada garantem que os passos 1-2 funcionem e que o pipeline não morra silenciosamente.

