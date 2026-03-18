

# Fix: Saudação Proativa Não Enviada ao WhatsApp

## Causa Raiz

A linha 7249-7251 chama `send-meta-whatsapp` com parâmetros **errados**:

```typescript
// ATUAL (errado) — parâmetros não reconhecidos pela função
body: { conversationId, message: assistantMessageGreeting, contactPhone: contact.phone }
```

A função `send-meta-whatsapp` espera `instance_id` e `phone_number` (obrigatórios, validados na linha 256). Como não recebe esses campos, retorna erro 400 silenciosamente (engolido pelo `.catch`).

## Correção (linhas 7247-7252)

Substituir a chamada incorreta pela mesma lógica usada no restante do arquivo (~20 ocorrências corretas):

```typescript
if (!greetSaveErr && (responseChannel === 'whatsapp' || responseChannel === 'whatsapp_meta')) {
  try {
    const whatsappResult = await getWhatsAppInstanceForConversation(
      supabaseClient,
      conversationId,
      conversation
    );
    if (whatsappResult && whatsappResult.provider === 'meta') {
      const targetNumber = extractWhatsAppNumber(contact.whatsapp_id) || contact.phone?.replace(/\D/g, '');
      await supabaseClient.functions.invoke('send-meta-whatsapp', {
        body: {
          instance_id: whatsappResult.instance.id,
          phone_number: targetNumber,
          message: assistantMessageGreeting,
          conversation_id: conversationId,
          skip_db_save: true,
        }
      });
    }
  } catch (e: any) {
    console.warn('[ai-autopilot-chat] Falha ao enviar saudação proativa:', e);
  }
}
```

## Deploy
- Editar `supabase/functions/ai-autopilot-chat/index.ts` (linhas 7247-7252)
- Redeploy da Edge Function `ai-autopilot-chat`

