

## Plano: Corrigir Delay no Realtime das Conversas

### Diagnóstico do Problema

Após análise detalhada do sistema, identifiquei **5 causas principais** para o delay nas mensagens:

---

### 1. **Problema: `invalidateQueries` ao invés de merge direto**

**Localização:** `useMessages.tsx` linha 157-167

Quando uma mensagem chega via realtime, o sistema faz `invalidateQueries` para `conversations`, o que força um **refetch completo** da lista de conversas. Isso causa:
- Requisição HTTP adicional ao banco
- Latência de rede (100-500ms)
- Re-render de toda a lista

**Solução:** Fazer merge otimista direto no cache ao invés de invalidar.

---

### 2. **Problema: Múltiplos canais realtime redundantes**

O sistema mantém **vários canais simultâneos** escutando as mesmas tabelas:
- `useMessages` → escuta `messages`
- `useMessagesOffline` → escuta `messages` (duplicado)
- `useConversations` → escuta `conversations`
- `useInboxView` → escuta `inbox_view`

Cada canal adiciona overhead e pode causar race conditions.

**Solução:** Consolidar em um único canal por contexto.

---

### 3. **Problema: Debounce de 100ms na atualização do sidebar**

**Localização:** `useMessages.tsx` linha 151-167

```typescript
conversationsInvalidateTimeout = setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
}, 100);
```

Embora 100ms pareça rápido, isso adiciona latência desnecessária quando combinado com o refetch.

**Solução:** Remover debounce e fazer update inline.

---

### 4. **Problema: Query inicial usa `staleTime: 5000`**

**Localização:** `useInboxView.tsx` linha 245

```typescript
staleTime: 5000, // 5 segundos
```

O React Query considera os dados "frescos" por 5 segundos, o que pode ignorar atualizações intermediárias.

**Solução:** Reduzir para 1000ms ou usar `staleTime: 0` para mensagens críticas.

---

### 5. **Problema: Trigger de `inbox_view` executa query pesada**

Os triggers do banco que atualizam `inbox_view` fazem queries adicionais (ex: buscar último snippet, contar unread), o que adiciona latência no lado do banco antes de emitir o evento realtime.

**Solução:** Otimizar triggers para serem mais leves ou usar NOTIFY/LISTEN customizado.

---

## Mudanças Propostas

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMessages.tsx` | Substituir invalidateQueries por merge otimista inline |
| `src/hooks/useInboxView.tsx` | Reduzir staleTime e otimizar merge |
| `src/hooks/useMessagesOffline.tsx` | Remover duplicação - usar apenas useMessages |
| Migration SQL | Otimizar trigger de inbox_view |

---

### Implementação Técnica

#### 1. Otimizar `useMessages.tsx` - Remover invalidação redundante

**Antes:**
```typescript
conversationsInvalidateTimeout = setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
  queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
}, 100);
```

**Depois:**
```typescript
// Atualizar snippet inline no inbox_view cache
queryClient.setQueryData(
  ["inbox-view", user?.id, role, departmentIds, filters],
  (prev: InboxViewItem[] = []) => {
    return prev.map(item => 
      item.conversation_id === conversationId 
        ? { 
            ...item, 
            last_snippet: newMessage.content?.slice(0, 100),
            last_message_at: newMessage.created_at,
            last_sender_type: newMessage.sender_type,
            updated_at: newMessage.created_at,
          } 
        : item
    ).sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }
);
```

#### 2. Reduzir staleTime em `useInboxView.tsx`

**Antes:**
```typescript
staleTime: 5000,
refetchInterval: 30000,
```

**Depois:**
```typescript
staleTime: 1000, // Reduzir para 1 segundo
refetchInterval: 15000, // Fallback mais frequente
```

#### 3. Adicionar canal realtime direto para mensagens no inbox

Criar subscription dedicada que atualiza o snippet instantaneamente:

```typescript
// Em useInboxView.tsx - adicionar subscription de messages
const messagesChannel = supabase
  .channel("inbox-messages-realtime")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
    },
    (payload) => {
      const newMsg = payload.new as Message;
      // Update inline do snippet sem esperar o trigger de inbox_view
      queryClient.setQueryData<InboxViewItem[]>(
        [...QUERY_KEY, user?.id, role, departmentIds, filters],
        (prev = []) => prev.map(item => 
          item.conversation_id === newMsg.conversation_id 
            ? { 
                ...item, 
                last_snippet: newMsg.content?.slice(0, 100),
                last_message_at: newMsg.created_at,
                last_sender_type: newMsg.sender_type,
                unread_count: (item.unread_count || 0) + (newMsg.sender_type === 'contact' ? 1 : 0),
                updated_at: new Date().toISOString(),
              } 
            : item
        ).sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      );
    }
  )
  .subscribe();
```

#### 4. Otimizar trigger do banco

Criar trigger mais leve que apenas atualiza campos essenciais:

```sql
-- Trigger otimizado para inbox_view
CREATE OR REPLACE FUNCTION public.update_inbox_view_on_message_fast()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update mínimo: só campos essenciais
  UPDATE inbox_view SET
    last_message_at = NEW.created_at,
    last_snippet = LEFT(NEW.content, 100),
    last_sender_type = NEW.sender_type,
    last_channel = NEW.channel,
    unread_count = CASE 
      WHEN NEW.sender_type = 'contact' 
      THEN unread_count + 1 
      ELSE unread_count 
    END,
    updated_at = now()
  WHERE conversation_id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;
```

---

## Fluxo Otimizado

```text
1. Mensagem chega do WhatsApp/Widget
   |
2. INSERT em messages → Trigger NOTIFICA inbox_view
   |
   +--→ [Parallel] Frontend recebe via Realtime
   |         |
   |         +--→ setQueryData INLINE (0ms delay)
   |         |
   |         +--→ UI atualiza INSTANTANEAMENTE
   |
3. Trigger atualiza inbox_view → Segundo evento Realtime
   |
   +--→ [Parallel] Frontend recebe UPDATE de inbox_view
             |
             +--→ Merge com dados já atualizados (noop)
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Tempo para mensagem aparecer | 500-2000ms | < 100ms |
| Tempo para snippet atualizar | 1000-3000ms | < 200ms |
| Requisições HTTP por mensagem | 2-3 | 0 (apenas realtime) |
| Re-renders | Lista inteira | Apenas item afetado |

---

## Testes a Realizar

1. Enviar mensagem de outro dispositivo → verificar aparece em < 100ms
2. Receber mensagem de cliente → verificar snippet atualiza imediatamente
3. Múltiplas mensagens em sequência → verificar sem flickering
4. Reconexão após perda de rede → verificar catch-up funciona

