
# Plano de Correção: Delay em WhatsApp (Meta e Evolution)

## Diagnóstico

O plano anterior foi **parcialmente implementado**:

| Componente | Status | Problema |
|------------|--------|----------|
| `useMessages.tsx` | ✅ Corrigido | Deduplicação com `processedIdsRef` + content matching |
| `useInboxView.tsx` | ✅ Corrigido | Canal redundante removido |
| `useSendMessageInstant.tsx` | ✅ Corrigido | Fire-and-forget + ACK explícito |
| Notas internas | ✅ Corrigido | Usa `sendInstant` |
| Web chat | ✅ Corrigido | Usa `sendInstant` |
| **WhatsApp Meta** | ❌ NÃO CORRIGIDO | UI bloqueia aguardando edge function |
| **WhatsApp Evolution** | ❌ NÃO CORRIGIDO | Usa `sendMessage.mutateAsync` (síncrono) |

---

## Problema Técnico Detalhado

### WhatsApp Meta (linhas 213-297)
```
1. Usuário clica "Enviar"
2. await supabase.functions.invoke('send-meta-whatsapp')  ← BLOQUEIA 2-5s
3. Edge function envia para Meta API
4. Edge function salva no banco
5. Edge function retorna
6. FINALMENTE mensagem aparece  ← DELAY PERCEBIDO!
```

### WhatsApp Evolution (linhas 298-373)
```
1. Usuário clica "Enviar"  
2. await supabase.functions.invoke('send-whatsapp-message')  ← BLOQUEIA 1-3s
3. Edge function envia para Evolution API
4. await sendMessage.mutateAsync()  ← BLOQUEIA MAIS 500ms-1s
5. FINALMENTE mensagem aparece  ← DELAY TOTAL: 2-4s!
```

---

## Solução: Padrão Otimista para WhatsApp

### Arquitetura Proposta

```
1. Usuário clica "Enviar"
2. sendInstant() → Mensagem aparece INSTANTANEAMENTE (status: sending)
3. queueMicrotask: Enviar para WhatsApp em background
4. Se sucesso → Atualizar status para "sent" + ACK
5. Se falha → Marcar como "failed" + opção de retry
```

---

## Alterações Necessárias

### 1. Expandir `useSendMessageInstant` para WhatsApp

Adicionar parâmetro `whatsappConfig` opcional:

```typescript
interface SendInstantParams {
  conversationId: string;
  content: string;
  isInternal?: boolean;
  channel?: string;
  // NOVO: Config para WhatsApp
  whatsappConfig?: {
    provider: 'meta' | 'evolution';
    instanceId: string;
    phoneNumber: string;
    media?: { type: string; url: string; filename?: string };
  };
}
```

Dentro do `queueMicrotask`, verificar se é WhatsApp e chamar a edge function correspondente ANTES de inserir no banco.

### 2. Refatorar `SuperComposer.tsx`

**Antes (Meta WhatsApp):**
```typescript
// 10+ linhas de código síncrono que bloqueia
const { data: metaResponse, error: metaError } = await supabase.functions.invoke(...);
```

**Depois:**
```typescript
// 1 linha - instantâneo
sentMessageId = sendInstant({
  conversationId,
  content: messageContent,
  channel: 'whatsapp',
  whatsappConfig: {
    provider: 'meta',
    instanceId: whatsappMetaInstanceId,
    phoneNumber: contactPhone,
  }
});
```

### 3. Edge Function: Não salvar mensagem no banco

A edge function `send-meta-whatsapp` atualmente salva a mensagem (linhas 344-355). Isso causa duplicação porque o frontend também salva via `sendInstant`.

**Solução:** Passar flag `skip_db_save: true` quando o frontend já fez insert otimista, OU remover insert da edge function e deixar tudo no frontend.

### 4. Fallback para erros

Se edge function falhar:
- Marcar mensagem como `status: 'failed'`
- Salvar `delivery_error` no metadata
- Mostrar botão "Tentar novamente" na UI

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSendMessageInstant.tsx` | Adicionar suporte a WhatsApp (meta + evolution) |
| `src/components/inbox/SuperComposer.tsx` | Usar `sendInstant` para todos os canais |
| `supabase/functions/send-meta-whatsapp/index.ts` | Aceitar flag `skip_db_save` |
| `supabase/functions/send-whatsapp-message/index.ts` | Aceitar flag `skip_db_save` |

---

## Fluxo Completo Proposto

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO OTIMISTA PARA WHATSAPP                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SuperComposer.tsx                                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  handleSend()                                                      │ │
│  │                                                                    │ │
│  │  // TODOS os canais usam sendInstant (instantâneo)                │ │
│  │  sentMessageId = sendInstant({                                    │ │
│  │    conversationId,                                                │ │
│  │    content,                                                       │ │
│  │    channel: 'whatsapp',                                          │ │
│  │    whatsappConfig: { provider, instanceId, phoneNumber }         │ │
│  │  });                                                              │ │
│  │                                                                    │ │
│  │  setMessage('');  // Limpa input IMEDIATAMENTE                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                            │                                            │
│                            ▼                                            │
│  useSendMessageInstant.tsx                                              │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  sendInstant()                                                     │ │
│  │                                                                    │ │
│  │  1. localId = crypto.randomUUID()                                 │ │
│  │  2. queryClient.setQueryData() → Mensagem aparece INSTANTANEAMENTE│ │
│  │  3. queueMicrotask(async () => {                                  │ │
│  │       if (whatsappConfig) {                                       │ │
│  │         // Enviar para WhatsApp PRIMEIRO (não bloqueia UI)        │ │
│  │         await supabase.functions.invoke('send-meta-whatsapp', {   │ │
│  │           body: { ...whatsappConfig, skip_db_save: true }         │ │
│  │         });                                                       │ │
│  │       }                                                           │ │
│  │       // Depois persistir no banco                                │ │
│  │       await supabase.from('messages').insert({...});              │ │
│  │       // Atualizar status para 'sent'                             │ │
│  │     });                                                           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---------|-------|--------|
| Latência WhatsApp Meta | 2-5 segundos | <100ms |
| Latência WhatsApp Evolution | 2-4 segundos | <100ms |
| Latência web_chat | <50ms | <50ms (sem mudança) |
| Latência notas internas | <50ms | <50ms (sem mudança) |

---

## Testes Recomendados

Após implementação:

1. **WhatsApp Meta**: Enviar mensagem e verificar que input limpa instantaneamente
2. **WhatsApp Evolution**: Mesmo teste
3. **Verificar duplicação**: Enviar 5 mensagens rápidas, verificar zero duplicatas
4. **Teste de falha**: Desconectar WiFi antes de enviar, verificar que mostra "failed"
5. **Console logs**: Verificar timestamps de latência no log `[SendInstant]`
