
# Plano: Mensagem de "Aguarde" Quando Cliente Está na Fila

## Problema Identificado

Atualmente, quando o cliente está em `waiting_human` (na fila aguardando atendente) e envia uma mensagem:
- O `process-chat-flow` retorna `skipAutoResponse: true` ✅
- O webhook simplesmente faz `continue` sem enviar nada ❌

**Resultado:** Cliente fica sem resposta, pode pensar que foi ignorado.

## Solução: Mensagem Tranquilizadora Automática

Quando `skipAutoResponse: true` E `reason` indica que cliente está na fila, enviar uma mensagem de aguarde:

```text
💬 Sua conversa já está na fila de atendimento. 

Fique tranquilo, em breve um especialista irá te atender. 🙂
```

---

## Alteração a Implementar

### 1. Edge Function: `meta-whatsapp-webhook/index.ts`

**Linhas 562-570** - Adicionar mensagem de aguarde:

```typescript
// CASO 1: skipAutoResponse = true → Cliente na fila/copilot/disabled
if (flowData.skipAutoResponse) {
  console.log("[AUTO-DECISION] [WhatsApp Meta] Flow skipAutoResponse → waiting_human");
  
  // 🆕 MENSAGEM DE AGUARDE: Enviar confirmação ao cliente na fila
  // Apenas se reason indica que está esperando humano (não kill switch)
  if (flowData.reason === 'ai_mode_waiting_human') {
    console.log("[meta-whatsapp-webhook] 📨 Enviando mensagem de aguarde...");
    
    const queueMessage = "💬 Sua conversa já está na fila de atendimento.\n\nFique tranquilo, em breve um especialista irá te atender. 🙂";
    
    try {
      await supabase.functions.invoke("send-meta-whatsapp", {
        body: {
          instance_id: instance.id,
          phone_number: fromNumber,
          message: queueMessage,
          conversation_id: conversation.id,
          skip_db_save: false,
        },
      });
      console.log("[meta-whatsapp-webhook] ✅ Mensagem de aguarde enviada");
    } catch (queueErr) {
      console.error("[meta-whatsapp-webhook] ⚠️ Erro ao enviar mensagem de aguarde:", queueErr);
    }
  }
  
  // Garantir que está em waiting_human
  await supabase
    .from("conversations")
    .update({ ai_mode: "waiting_human" })
    .eq("id", conversation.id);
  
  continue;
}
```

### 2. Considerar Rate Limiting (Proteção Anti-Spam)

Para evitar que o cliente receba muitas mensagens de "aguarde" se mandar várias mensagens seguidas:

```typescript
// 🛡️ ANTI-SPAM: Verificar última mensagem do sistema
const { data: lastBotMsg } = await supabase
  .from("messages")
  .select("created_at, content")
  .eq("conversation_id", conversation.id)
  .eq("sender_type", "user") // "user" = bot/sistema no modelo atual
  .eq("is_ai_generated", true)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

// Só enviar se última mensagem do bot foi há mais de 2 minutos
const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
const lastMsgDate = lastBotMsg?.created_at ? new Date(lastBotMsg.created_at) : null;
const shouldSendQueueMsg = !lastMsgDate || lastMsgDate < twoMinutesAgo;

if (shouldSendQueueMsg) {
  // Enviar mensagem de aguarde...
}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Adicionar mensagem de aguarde quando `skipAutoResponse` + `waiting_human` |

---

## Impacto

### Antes (Problema)
| Cenário | Resultado |
|---------|-----------|
| Cliente na fila manda "Oi" | ❌ Silêncio total |
| Cliente na fila manda "Demora muito?" | ❌ Silêncio total |
| Cliente na fila manda "?" | ❌ Silêncio total |

### Depois (Corrigido)
| Cenário | Resultado |
|---------|-----------|
| Cliente na fila manda "Oi" | ✅ "Sua conversa já está na fila... em breve um especialista irá te atender" |
| Cliente na fila manda "Demora muito?" | ✅ Mesma mensagem (max 1x a cada 2 min) |
| Cliente na fila manda "?" | ✅ Mesma mensagem (rate limited) |

---

## Segurança

| Controle | Status |
|----------|--------|
| Fluxo não reinicia quando cliente está na fila | ✅ Mantido |
| IA não responde quando humano está atendendo | ✅ Mantido |
| Mensagem de aguarde não dispara em `copilot` | ✅ Só em `waiting_human` |
| Rate limiting para evitar spam | ✅ 2 minutos entre mensagens |
| Compatível com Super Prompt v2.3 | ✅ |

---

## Fluxo Visual

```text
Cliente (na fila)         Webhook         process-chat-flow         WhatsApp
       |                     |                    |                    |
       |--- "Oi, demora?"-->|                    |                    |
       |                     |--save message----->|                    |
       |                     |                    |                    |
       |                     |--process flow?---->|                    |
       |                     |                    |--check ai_mode---->|
       |                     |                    |<--waiting_human----|
       |                     |                    |                    |
       |                     |<--skipAutoResponse-|                    |
       |                     |   reason: ai_mode_waiting_human         |
       |                     |                    |                    |
       |                     |--- [NOVO] Enviar mensagem de aguarde--->|
       |<-------- "Sua conversa já está na fila..." ------------------|
       |                     |                    |                    |
       |        [Mensagem + confirmação aparecem no histórico]         |
```

---

## Compatibilidade

A mudança é **backward compatible**:
- Comportamento de `copilot` e `disabled` não muda (silêncio total)
- Apenas `waiting_human` recebe a mensagem de aguarde
- Rate limiting previne spam
- Humano ainda pode assumir a qualquer momento
