

## Plano: Corrigir Envio de Mensagens da IA via Meta WhatsApp API

### Problema Identificado

A IA está gerando respostas corretamente mas **não consegue enviá-las** porque a função `ai-autopilot-chat` está hardcoded para usar a **Evolution API** (descontinuada), enquanto as conversas agora usam a **Meta WhatsApp Cloud API**.

**Logs de erro:**
```
❌ Nenhuma instância WhatsApp disponível
```

**Causa raiz:**
1. Conversas têm `whatsapp_provider: 'meta'` e `whatsapp_meta_instance_id: d9fafe12-...`
2. Mas `getWhatsAppInstanceForConversation()` só busca na tabela `whatsapp_instances` (Evolution)
3. Todas as instâncias Evolution estão `disconnected` ou `qr_pending`
4. Resultado: função retorna `null`, mensagem não é enviada

---

### Solucao Proposta

Modificar a funcao `ai-autopilot-chat` para **rotear dinamicamente** entre Meta API e Evolution API baseado no campo `whatsapp_provider` da conversa.

---

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Adicionar suporte ao Meta WhatsApp API |

---

### Implementacao Detalhada

**1. Atualizar funcao `getWhatsAppInstanceForConversation` para suportar Meta:**

```typescript
// Nova assinatura com suporte ao provider
async function getWhatsAppInstanceForConversation(
  supabaseClient: any,
  conversationId: string,
  conversationWhatsappInstanceId: string | null,
  whatsappProvider: string | null = 'evolution',
  whatsappMetaInstanceId: string | null = null
): Promise<{ instance: any; provider: 'meta' | 'evolution' } | null> {
  
  // 1. Se é Meta provider, buscar na tabela whatsapp_meta_instances
  if (whatsappProvider === 'meta' && whatsappMetaInstanceId) {
    const { data: metaInstance } = await supabaseClient
      .from('whatsapp_meta_instances')
      .select('*')
      .eq('id', whatsappMetaInstanceId)
      .single();
    
    if (metaInstance && metaInstance.status === 'active') {
      console.log('[getWhatsAppInstance] ✅ Usando instância META:', {
        instanceId: metaInstance.id,
        phoneNumberId: metaInstance.phone_number_id,
        name: metaInstance.name
      });
      return { instance: metaInstance, provider: 'meta' };
    }
  }
  
  // 2. Fallback para Meta se provider é meta mas instância vinculada não existe
  if (whatsappProvider === 'meta') {
    const { data: fallbackMeta } = await supabaseClient
      .from('whatsapp_meta_instances')
      .select('*')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    
    if (fallbackMeta) {
      console.log('[getWhatsAppInstance] 🔄 Usando instância META FALLBACK:', fallbackMeta.id);
      return { instance: fallbackMeta, provider: 'meta' };
    }
  }
  
  // 3. Evolution API (código existente para retrocompatibilidade)
  // ... manter lógica atual ...
}
```

**2. Modificar a logica de envio (linha 4844-4900) para usar o provider correto:**

```typescript
// Obter instância com suporte a ambos providers
const whatsappResult = await getWhatsAppInstanceForConversation(
  supabaseClient, 
  conversationId, 
  conversation.whatsapp_instance_id,
  conversation.whatsapp_provider,        // NOVO: passar provider
  conversation.whatsapp_meta_instance_id // NOVO: passar meta instance id
);

if (!whatsappResult) {
  console.error('[ai-autopilot-chat] ⚠️ NENHUMA instância WhatsApp disponível');
  // ... tratamento de erro existente ...
}

const { instance: whatsappInstance, provider } = whatsappResult;

// Enviar baseado no provider
if (provider === 'meta') {
  console.log('[ai-autopilot-chat] 📤 Invocando send-meta-whatsapp:', {
    instanceId: whatsappInstance.id,
    phoneNumberId: whatsappInstance.phone_number_id,
    phoneNumber: contact.phone
  });

  const { data: metaResponse, error: metaError } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
    body: {
      instance_id: whatsappInstance.id,
      phone_number: contact.phone?.replace(/\D/g, ''),
      message: assistantMessage,
      conversation_id: conversationId
    },
  });

  if (metaError) throw metaError;
  
  console.log('[ai-autopilot-chat] ✅ Resposta enviada via Meta WhatsApp API');
} else {
  // Manter código Evolution existente
  console.log('[ai-autopilot-chat] 📤 Invocando send-whatsapp-message (Evolution)');
  // ... código Evolution atual ...
}
```

**3. Atualizar busca da conversa para incluir campos Meta:**

Na linha 566, adicionar campos na query:
```typescript
.select(`
  *,
  whatsapp_provider,
  whatsapp_meta_instance_id,
  contacts!inner (...)
`)
```

---

### Fluxo Apos Correcao

```
Cliente envia mensagem WhatsApp
          ↓
meta-whatsapp-webhook salva mensagem
          ↓
          ↓ trigger autopilot
          ↓
ai-autopilot-chat:
  1. Verifica ai_mode = 'autopilot' ✅
  2. Gera resposta com IA ✅
  3. Detecta whatsapp_provider = 'meta' ← NOVO
  4. Busca instância em whatsapp_meta_instances ← NOVO
  5. Chama send-meta-whatsapp ← NOVO
          ↓
Mensagem enviada ao cliente ✅
```

---

### Pontos de Teste

1. Enviar mensagem de cliente via WhatsApp
2. Verificar se IA responde
3. Verificar logs: `✅ Resposta enviada via Meta WhatsApp API`
4. Confirmar mensagem recebida no WhatsApp do cliente

---

### Secao Tecnica Detalhada

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

**Linhas afetadas:**
- 97-144: Funcao `getWhatsAppInstanceForConversation`
- 566-584: Query da conversa
- 4844-4900: Logica de envio

**Mudancas na query da conversa (linha 570):**
```diff
  .select(`
    *,
+   whatsapp_provider,
+   whatsapp_meta_instance_id,
    contacts!inner (
      id, first_name, last_name, email, phone, whatsapp_id, company, status, document, kiwify_validated, kiwify_validated_at
    )
  `)
```

**Nova estrutura de retorno do helper:**
```typescript
interface WhatsAppInstanceResult {
  instance: any;
  provider: 'meta' | 'evolution';
}
```

**Edge Function a fazer redeploy:**
- `ai-autopilot-chat`

