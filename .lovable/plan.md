

# Fix: IA envia menu genérico após email — SEMPRE continuar com contexto da conversa

## Problema Identificado (Conversa #18FDE6F4)

```
Cliente: "Comprei mais não recebi acesso"
IA: "Qual produto?"
Cliente: "Associado Premium"
IA: "Me informe o email"
Cliente: libertecdados@gmail.com
IA: "Encontrei! 1-Pedidos 2-Sistema" ← ERRADO
```

**Causa raiz**: O `original_intent` só é salvo quando a IA pede email via **Identity Wall** (linha 4558). Neste caso, a IA pediu email como parte da conversa natural — o email foi capturado pelo **detector genérico** (linha 2822), que não tem `original_intent` salvo no metadata. Resultado: cai no else final (linha 3018) e envia o menu hardcoded.

## Solução

### `supabase/functions/ai-autopilot-chat/index.ts` — Bloco else final (linhas 3018-3022)

Quando não há consultor, nem flow_context, nem original_intent salvo — em vez de enviar o menu, **sempre continuar com contexto da conversa** (skipEarlyReturn = true). A IA já tem todo o histórico de mensagens e sabe que o cliente falou sobre "acesso" e "Associado Premium".

**Antes:**
```typescript
} else {
  // Sem consultor, sem flow_context, sem intent - Master Flow assume triagem
  autoResponse = foundMessage; // ← MENU "1-Pedidos 2-Sistema"
}
```

**Depois:**
```typescript
} else {
  // 🆕 FIX: Sempre continuar com contexto da conversa, nunca enviar menu genérico
  // A IA tem acesso ao histórico completo e pode responder sobre o assunto que o cliente já mencionou
  console.log('[ai-autopilot-chat] 🎯 Email verificado - continuando com contexto da conversa (sem menu genérico)');
  const customerName = contact.first_name || verifyResult.customer?.name || 'cliente';
  autoResponse = `Encontrei seu cadastro, ${customerName}! ✅\n\nVoltando à sua dúvida...`;
  skipEarlyReturn = true;
}
```

Isso faz a IA:
1. Confirmar que encontrou o cadastro
2. Continuar processando normalmente — usando o histórico de mensagens que já contém "Comprei mas não recebi acesso" + "Associado Premium"
3. Buscar na KB e responder com a informação correta

## Governança
- Zero regressão: o menu nunca era útil nesse cenário — a conversa já tinha contexto
- O bloco do consultant redirect (linha 2950) permanece intacto
- O bloco do flow_context (linhas 3001-3017) permanece intacto
- O bloco do original_intent (linha 2988) permanece intacto (continua funcionando quando Identity Wall salva contexto)

