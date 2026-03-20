

## Auditoria Completa — Estado Atual do Sistema

### Verificação dos Fixes Anteriores

| Fix | Arquivo | Status |
|-----|---------|--------|
| Bug 3: `skipInitialMessage` no buffer | `meta-whatsapp-webhook` L1233 | ✅ OK |
| Bug 4: CRON mode bypass | `process-buffered-messages` L149-170 | ✅ OK |
| Bug B: Bypass Strict RAG (dados estruturados) | `ai-autopilot-chat` L4935-4948 | ✅ OK |
| Bug C: "valor" removido de `commercialTerms` | `ai-autopilot-chat` L7985 | ✅ OK |
| `withdrawal_amount` como string | `ai-autopilot-chat` L7386-7388 | ✅ OK |
| `formatAmount()` (safe `.toFixed`) | `ai-autopilot-chat` L1167-1170 | ✅ OK |
| Fallback ticket determinístico (OTP+dados) | `ai-autopilot-chat` L7946-7979 | ⚠️ 2 BUGS |

### Bugs Encontrados

**Bug 1 — `category: 'financial'` invalida no fallback (CRÍTICO)**
Linha 7956 do `ai-autopilot-chat`:
```typescript
category: 'financial'  // ❌ INVÁLIDO — valores aceitos: 'financeiro' | 'tecnico' | 'bug' | 'outro'
```
O `generate-ticket-from-conversation` aceita apenas `financeiro`, `tecnico`, `bug`, `outro` (linha 13 da interface). Com `'financial'`, o ticket é criado mas **sem mapeamento de departamento** (linha 192-196 do generate), ficando órfão.

**Bug 2 — Envio WhatsApp usa Evolution API em vez de Meta (CRÍTICO)**
Linhas 7965-7967: o fallback usa `send-whatsapp-message` (Evolution API) com query por `whatsapp_instances`. Mas a maioria das conversas é Meta API. O restante do arquivo usa `getWhatsAppInstanceForConversation` + `sendWhatsAppMessage` helper ou `send-meta-whatsapp` direto.

**Bug 3 — DIRECT mode do `process-buffered-messages` não verifica `skipInitialMessage`**
Linha 317: quando chamado em DIRECT mode (com `conversationId`), passa `concatenatedMessage` bruto (o dígito "2") sem verificar `originalFlowData?.skipInitialMessage`. Apenas o CRON mode (linha 149) tem o check.

### Plano de Correção — 3 edições

**Edição 1: `ai-autopilot-chat/index.ts` L7956 — Corrigir category**
```typescript
category: 'financeiro'  // era 'financial'
```

**Edição 2: `ai-autopilot-chat/index.ts` L7965-7967 — Corrigir envio WhatsApp**
Substituir o bloco Evolution API manual pelo padrão usado em todo o arquivo:
```typescript
if (responseChannel === 'whatsapp' && contact?.phone && conversation) {
  try {
    const whatsappResultFallback = await getWhatsAppInstanceForConversation(
      supabaseClient, conversationId, contact, conversation
    );
    if (whatsappResultFallback) {
      await sendWhatsAppMessage(
        supabaseClient, whatsappResultFallback,
        contact.phone, fallbackResponse,
        conversationId, contact.whatsapp_id
      );
    }
  } catch (sendErr) {
    console.error('[ai-autopilot-chat] ❌ Fallback WhatsApp send failed:', sendErr);
  }
}
```

**Edição 3: `process-buffered-messages/index.ts` ~L315 — DIRECT mode skipInitialMessage**
Antes de `callPipeline`, adicionar check:
```typescript
// Check skipInitialMessage in DIRECT mode too
if ((originalFlowData as any)?.skipInitialMessage === true) {
  console.log(`[process-buffered-messages] ⏭️ DIRECT mode: skipInitialMessage=true → saudação proativa`);
  await callPipeline(supabase, {
    conversationId,
    concatenatedMessage: "",
    contactId,
    instanceId: effectiveInstanceId,
    fromNumber,
    flowContext,
    flowData: originalFlowData,
  });
  return new Response(
    JSON.stringify({ status: "processed", reason: "skip_initial_message_greeting" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**Deploy:** `ai-autopilot-chat` + `process-buffered-messages`

### Resultado
- Fallback financeiro cria ticket com `category: 'financeiro'` → mapeado ao departamento Financeiro
- Mensagem de confirmação enviada pelo canal correto (Meta ou Evolution, conforme a conversa)
- DIRECT mode também respeita `skipInitialMessage` → saudação proativa em ambos os modos

