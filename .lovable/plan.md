

# Plano: Correção do Envio de Pesquisa de Satisfação via WhatsApp Meta

## Diagnóstico Confirmado

### Problema Identificado
O sistema **não envia** a pesquisa de satisfação para clientes no WhatsApp, apesar de:
1. `sendCsat: true` ser passado corretamente
2. A mensagem aparecer no sistema

### Causa Raiz
A função `close-conversation` verifica **apenas** `whatsapp_instance_id` (Evolution API), mas as conversas usam `whatsapp_meta_instance_id` (Meta Cloud API):

```
Conversas recentes:
├── whatsapp_instance_id: NULL ❌
└── whatsapp_meta_instance_id: d9fafe12-... ✅ (Meta Oficial)
```

### Código Problemático (linha 194)

```typescript
// Só verifica Evolution API - ignora Meta!
if (sendCsat && conversation.channel === "whatsapp" && conversation.whatsapp_instance_id) {
```

---

## Solução Proposta

Modificar `close-conversation` para:
1. Buscar também `whatsapp_meta_instance_id`
2. Detectar qual tipo de instância está sendo usada
3. Chamar a função correta (`send-meta-whatsapp` ou `send-whatsapp-message`)
4. Usar `whatsapp_id` como prioridade (correção anterior)

---

## Alterações Detalhadas

### 1. Atualizar a query de busca da conversa

**Arquivo**: `supabase/functions/close-conversation/index.ts`

**Local**: Linhas 36-54

Adicionar `whatsapp_meta_instance_id` e buscar dados da instância Meta:

```typescript
const { data: conversation, error: convError } = await supabase
  .from("conversations")
  .select(`
    id,
    channel,
    contact_id,
    whatsapp_instance_id,
    whatsapp_meta_instance_id,
    created_at,
    assigned_to,
    contacts (
      id,
      first_name,
      last_name,
      phone,
      whatsapp_id
    )
  `)
  .eq("id", conversationId)
  .single();
```

### 2. Buscar instância Meta se aplicável

**Local**: Após linha 62 (após verificar conversa existe)

```typescript
// Buscar instância Meta se whatsapp_meta_instance_id existir
let metaInstance = null;
if (conversation.whatsapp_meta_instance_id) {
  const { data: meta } = await supabase
    .from("whatsapp_meta_instances")
    .select("id, phone_number_id, access_token, status")
    .eq("id", conversation.whatsapp_meta_instance_id)
    .single();
  
  if (meta && meta.status === 'active') {
    metaInstance = meta;
    console.log(`[close-conversation] Meta instance found: ${meta.id}`);
  }
}
```

### 3. Atualizar a lógica de envio do CSAT

**Local**: Linhas 193-246 (bloco de envio CSAT)

Substituir por lógica que detecta e usa a instância correta:

```typescript
// Send CSAT via WhatsApp if requested and applicable
if (sendCsat && conversation.channel === "whatsapp") {
  const contact = conversation.contacts as unknown as { 
    id: string; 
    first_name: string; 
    last_name: string; 
    phone: string | null; 
    whatsapp_id: string | null 
  } | null;
  
  if (contact && (contact.phone || contact.whatsapp_id)) {
    const csatMessage = `📊 *Pesquisa de Satisfação*

Seu atendimento foi encerrado.

Por favor, avalie de 1 a 5:

1️⃣ Péssimo
2️⃣ Ruim
3️⃣ Regular
4️⃣ Bom
5️⃣ Excelente

_Responda apenas com o número._`;

    console.log(`[close-conversation] Sending CSAT for contact ${contact.id}`);

    // Extrair número limpo do whatsapp_id (prioridade) ou phone
    function extractWhatsAppNumber(whatsappId: string | null): string | null {
      if (!whatsappId) return null;
      if (whatsappId.includes('@lid')) return null; // LID não é número válido
      
      const cleaned = whatsappId
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '')
        .replace(/\D/g, '');
      
      return cleaned.length >= 10 ? cleaned : null;
    }

    const targetNumber = extractWhatsAppNumber(contact.whatsapp_id) || contact.phone?.replace(/\D/g, '');

    try {
      let whatsappError = null;

      // 🆕 PRIORIDADE 1: Meta Cloud API
      if (metaInstance) {
        console.log(`[close-conversation] 📤 Sending CSAT via Meta WhatsApp API to ${targetNumber?.slice(-4)}`);
        
        const { error: metaError } = await supabase.functions.invoke("send-meta-whatsapp", {
          body: {
            instance_id: metaInstance.id,
            phone_number: targetNumber,
            message: csatMessage,
            conversation_id: conversationId,
            skip_db_save: true, // Mensagem de sistema já foi salva
          },
        });

        whatsappError = metaError;
      }
      // FALLBACK: Evolution API
      else if (conversation.whatsapp_instance_id) {
        console.log(`[close-conversation] 📤 Sending CSAT via Evolution API to ${targetNumber?.slice(-4)}`);
        
        const { error: evoError } = await supabase.functions.invoke("send-whatsapp-message", {
          body: {
            instance_id: conversation.whatsapp_instance_id,
            phone_number: contact.phone,
            whatsapp_id: contact.whatsapp_id,
            message: csatMessage,
          },
        });

        whatsappError = evoError;
      }
      // Nenhuma instância encontrada
      else {
        console.log(`[close-conversation] ⚠️ No WhatsApp instance found for conversation`);
        whatsappError = { message: 'No WhatsApp instance configured' };
      }

      if (whatsappError) {
        console.error(`[close-conversation] Failed to send WhatsApp CSAT: ${whatsappError.message}`);
      } else {
        console.log(`[close-conversation] ✅ CSAT sent via WhatsApp successfully`);

        // Mark conversation as awaiting rating
        await supabase
          .from("conversations")
          .update({
            awaiting_rating: true,
            rating_sent_at: new Date().toISOString(),
          })
          .eq("id", conversationId);

        console.log(`[close-conversation] Conversation marked as awaiting_rating`);
      }
    } catch (whatsappErr) {
      console.error(`[close-conversation] WhatsApp send error:`, whatsappErr);
    }
  } else {
    console.log(`[close-conversation] No phone/whatsapp_id for contact, skipping WhatsApp CSAT`);
  }
}
```

---

## Resumo das Alterações

| Componente | Antes | Depois |
|------------|-------|--------|
| Query da conversa | Não busca `whatsapp_meta_instance_id` | Busca ambos os campos |
| Detecção de instância | Só verifica Evolution | Verifica Meta (prioridade) e Evolution |
| Função de envio | `send-whatsapp-message` (Evolution) | `send-meta-whatsapp` (Meta) ou fallback Evolution |
| Número de destino | `contact.phone` | `whatsapp_id` (prioridade) ou `phone` |

---

## Seção Técnica

### Fluxo de Envio do CSAT Corrigido

```text
close-conversation recebe sendCsat: true
         │
         ▼
Conversa é WhatsApp?
    SIM ──────────────────┐
         │                │
         ▼                ▼
Tem whatsapp_meta_instance_id?
    SIM ──────┐     NÃO ────┐
              │             │
              ▼             ▼
    Buscar instância Meta   Tem whatsapp_instance_id?
              │                 SIM ──────┐
              ▼                           │
    Instância ativa?                      │
    SIM ──────┐                           │
              │                           │
              ▼                           ▼
    send-meta-whatsapp         send-whatsapp-message
              │                           │
              └───────────┬───────────────┘
                          │
                          ▼
              Marcar awaiting_rating: true
```

### Arquivos a Modificar

| Arquivo | Ação | Linhas Afetadas |
|---------|------|-----------------|
| `close-conversation/index.ts` | Modificar | 36-54 (query), 62-80 (busca Meta), 193-246 (envio CSAT) |

---

## Ordem de Implementação

1. Atualizar query para buscar `whatsapp_meta_instance_id`
2. Adicionar lógica para buscar instância Meta
3. Refatorar bloco de envio CSAT com detecção de tipo
4. Adicionar helper `extractWhatsAppNumber`
5. Deploy da edge function
6. Testar encerramento de conversa com envio de CSAT

---

## Critérios de Aceitação

| Teste | Resultado Esperado |
|-------|-------------------|
| Encerrar conversa WhatsApp Meta | CSAT enviado via `send-meta-whatsapp` |
| Encerrar conversa Evolution | CSAT enviado via `send-whatsapp-message` |
| Logs mostram instância detectada | `"📤 Sending CSAT via Meta WhatsApp API"` |
| Cliente recebe mensagem | Pesquisa de 1-5 estrelas no WhatsApp |
| `awaiting_rating` atualizado | `true` após envio bem-sucedido |

