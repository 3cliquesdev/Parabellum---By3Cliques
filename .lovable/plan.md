

# Plano: Correção de Envio para WhatsApp Meta — Usar whatsapp_id

## Diagnóstico Confirmado

### Problema Identificado
O usuário reportou que clientes "que nunca enviaram mensagem" não recebem resposta. Na investigação descobri:

1. **Mensagem enviada com sucesso para a API do Meta** (`✅ Message sent: wamid...`)
2. **Webhook do Meta retorna status `failed`** para a entrega

### Causa Raiz
O contato Ronny teste tem:

| Campo | Valor | Comentário |
|-------|-------|------------|
| `phone` | 5511988013**283** | Número cadastrado |
| `whatsapp_id` | 5511988013**284**@s.whatsapp.net | Número real do WhatsApp |

Os números são **diferentes**! O sistema envia para o `phone`, mas o WhatsApp real é o `whatsapp_id`.

### Log do Webhook Confirmando

```text
📊 Status update: wamid.xxx -> failed  (para 5511988013283)
📊 Status update: wamid.xxx -> delivered (para 5511969656723)
```

O Ronildo Oliveira recebe porque `phone` e `whatsapp_id` são iguais. O Ronny teste não recebe porque são diferentes.

### Código com Inconsistência

**Evolution API (funciona):**
```typescript
// Linha 7366-7371
{
  phone_number: contact.phone,
  whatsapp_id: contact.whatsapp_id,  // ✅ USA WHATSAPP_ID
}
```

**Meta API (quebrado):**
```typescript
// Linha 7330-7337
{
  phone_number: contact.phone?.replace(/\D/g, ''),  // ❌ IGNORA WHATSAPP_ID
}
```

---

## Solução Proposta

### Lógica de Prioridade
Para qualquer envio WhatsApp, usar a seguinte ordem de prioridade:

```text
1. whatsapp_id (número real confirmado pelo WhatsApp)
2. phone (fallback se whatsapp_id não existir)
```

Exemplo:
```typescript
const targetNumber = extractWhatsAppNumber(contact.whatsapp_id) || contact.phone?.replace(/\D/g, '');
```

---

## Alterações Detalhadas

### 1. Criar helper `extractWhatsAppNumber`

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

**Local**: Após a linha 100 (seção de helpers)

```typescript
// ============================================================
// 🔧 HELPER: Extrair número limpo do whatsapp_id
// Formatos suportados:
//   - 5511999999999@s.whatsapp.net
//   - 5511999999999@c.us
//   - 5511999999999
// ============================================================
function extractWhatsAppNumber(whatsappId: string | null | undefined): string | null {
  if (!whatsappId) return null;
  
  // Remove sufixos do WhatsApp
  let cleaned = whatsappId
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .replace('@lid', '') // Leads do Meta (não usar)
    .replace(/\D/g, '');
  
  // Se for número @lid (lead ID do Meta), retornar null
  if (whatsappId.includes('@lid')) {
    return null;
  }
  
  return cleaned.length >= 10 ? cleaned : null;
}
```

### 2. Atualizar `sendWhatsAppMessage` para usar `whatsappId`

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

**Local**: Linhas 511-526 (seção Meta API)

```typescript
if (whatsappResult.provider === 'meta') {
  // 🆕 CORREÇÃO: Priorizar whatsapp_id sobre phone
  const targetNumber = extractWhatsAppNumber(whatsappId) || phoneNumber?.replace(/\D/g, '');
  
  console.log('[sendWhatsAppMessage] 📤 Enviando via Meta WhatsApp API:', {
    instanceId: whatsappResult.instance.id,
    phoneNumberId: whatsappResult.instance.phone_number_id,
    targetNumber: targetNumber?.slice(-4),
    usedWhatsappId: !!extractWhatsAppNumber(whatsappId)
  });
  
  const { data, error } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
    body: {
      instance_id: whatsappResult.instance.id,
      phone_number: targetNumber,  // 🆕 Usa targetNumber (whatsapp_id ou phone)
      message,
      conversation_id: conversationId,
      skip_db_save: true
    }
  });
  // ... resto igual
}
```

### 3. Atualizar chamada direta na linha 7330

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

**Local**: Linhas 7324-7338

```typescript
if (provider === 'meta') {
  // 🆕 CORREÇÃO: Priorizar whatsapp_id sobre phone
  const targetNumber = extractWhatsAppNumber(contact.whatsapp_id) || contact.phone?.replace(/\D/g, '');
  
  console.log('[ai-autopilot-chat] 📤 Invocando send-meta-whatsapp:', {
    instanceId: whatsappInstance.id,
    phoneNumberId: whatsappInstance.phone_number_id,
    targetNumber: targetNumber?.slice(-4),
    source: extractWhatsAppNumber(contact.whatsapp_id) ? 'whatsapp_id' : 'phone'
  });

  const { data: metaResponse, error: metaError } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
    body: {
      instance_id: whatsappInstance.id,
      phone_number: targetNumber,  // 🆕 Usa targetNumber
      message: assistantMessage,
      conversation_id: conversationId,
      skip_db_save: true
    },
  });
  // ... resto igual
}
```

### 4. Atualizar `handle-whatsapp-event` (mesmo problema)

**Arquivo**: `supabase/functions/handle-whatsapp-event/index.ts`

**Local**: Linhas 1168-1178 (envio de resposta do fluxo)

```typescript
// Extrair número correto
const targetNumber = phoneForDatabase.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');

await supabase.functions.invoke('send-meta-whatsapp', {
  body: {
    instance_id: instance.id,
    phone_number: targetNumber,  // 🆕 Já vem do webhook, deve estar correto
    message: flowResult.response,
    conversation_id: conversationId,
    skip_db_save: true
  }
});
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `ai-autopilot-chat/index.ts` | Modificar | Adicionar helper e usar `whatsapp_id` em todas as chamadas Meta |
| `handle-whatsapp-event/index.ts` | Verificar | Garantir que usa o número correto do webhook |

---

## Seção Técnica

### Fluxo de Decisão do Número

```text
Contato tem whatsapp_id?
    │
    ├─ SIM → Extrair número (remover @s.whatsapp.net)
    │         É válido (>= 10 dígitos)?
    │              │
    │              ├─ SIM → Usar whatsapp_id
    │              └─ NÃO → Usar phone
    │
    └─ NÃO → Usar phone?.replace(/\D/g, '')
```

### Casos de Teste

| Cenário | whatsapp_id | phone | Resultado |
|---------|-------------|-------|-----------|
| whatsapp_id válido | 5511999999999@s.whatsapp.net | 5511888888888 | Usa 5511999999999 |
| whatsapp_id @lid (inválido) | 123456789@lid | 5511888888888 | Usa 5511888888888 |
| whatsapp_id null | null | 5511888888888 | Usa 5511888888888 |
| Ambos iguais | 5511999999999@s.whatsapp.net | 5511999999999 | Usa 5511999999999 |

---

## Impacto

| Antes | Depois |
|-------|--------|
| Meta API usa `contact.phone` | Meta API usa `whatsapp_id` (com fallback para `phone`) |
| Mensagens falham para contatos com números diferentes | Mensagens entregues corretamente |
| Inconsistência entre Evolution e Meta | Comportamento uniforme |

---

## Ordem de Implementação

1. **Adicionar helper** `extractWhatsAppNumber`
2. **Atualizar** `sendWhatsAppMessage` para Meta API
3. **Atualizar** chamada direta na linha 7330
4. **Verificar** `handle-whatsapp-event` (provavelmente já correto)
5. **Deploy** edge functions
6. **Testar** com o contato Ronny teste

---

## Nota sobre Limpeza de Dados

Recomendação futura: Rodar script para unificar `phone` e `whatsapp_id` onde são diferentes mas próximos (apenas 1 dígito diferente pode ser erro de digitação):

```sql
-- Identificar contatos com discrepância
SELECT id, phone, whatsapp_id 
FROM contacts 
WHERE whatsapp_id IS NOT NULL 
  AND phone != REPLACE(REPLACE(whatsapp_id, '@s.whatsapp.net', ''), '@c.us', '');
```

