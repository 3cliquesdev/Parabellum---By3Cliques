
# Plano: Refatorar Sistema de Chat Humano para Tempo Real (<200ms)

## Diagnóstico Atual

### Fluxo Atual do Web Chat (Chat Humano)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL - LATÊNCIA ALTA (~30 segundos)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Usuário clica "Enviar"                                                      │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────┐                                                    │
│  │ onMutate (otimista)  │ ← Mensagem aparece com status "sending"           │
│  │ (temp-id local)      │   ~10ms ✅                                         │
│  └──────────────────────┘                                                    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ mutationFn (SÍNCRONO - BLOQUEANTE)                               │       │
│  │                                                                   │       │
│  │  1. supabase.from("messages").insert() ← Network + DB ~500-2000ms│       │
│  │                                                                   │       │
│  │  2. supabase.from("conversations").update() ← Mais ~200-500ms    │       │
│  │     (last_message_at)                                             │       │
│  │                                                                   │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────┐                                                    │
│  │ Realtime dispara     │ ← Evento postgres_changes ~100-300ms após INSERT  │
│  │ (substitui temp-id)  │                                                    │
│  └──────────────────────┘                                                    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────┐                                                    │
│  │ Triggers DB executam │ ← Múltiplos triggers podem adicionar ~1-5s       │
│  │ (inbox_view, etc)    │                                                    │
│  └──────────────────────┘                                                    │
│                                                                              │
│  TOTAL PERCEBIDO: 1-30 segundos (dependendo da carga do DB)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Problemas Identificados

| Problema | Impacto | Causa Raiz |
|----------|---------|------------|
| `mutationFn` bloqueia UI | Input fica "travado" | Aguarda INSERT completar |
| Update de `last_message_at` síncrono | +200-500ms | Operação secundária no caminho crítico |
| Triggers pesados na tabela messages | +1-5s | `inbox_view` refresh, embeddings, etc |
| Polling em background | Conflitos de cache | Múltiplas invalidateQueries |

---

## Solução Proposta: Fire-and-Forget + Realtime

### Novo Fluxo (Latência <200ms)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ NOVO FLUXO - LATÊNCIA <200ms                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Usuário clica "Enviar"                                                      │
│         │                                                                    │
│         ▼                                                                    │
│  ┌────────────────────────────────────────────────────┐                     │
│  │ OPTIMISTIC UPDATE (INSTANTÂNEO)                   │ ~5ms                │
│  │                                                    │                     │
│  │ 1. Gera UUID local (não temp-id)                  │                     │
│  │ 2. Adiciona ao cache React Query                  │                     │
│  │ 3. UI atualiza IMEDIATAMENTE                      │                     │
│  │ 4. Limpa input                                    │                     │
│  │ 5. RETORNA para o usuário (não aguarda DB)        │ ← CRÍTICO!          │
│  │                                                    │                     │
│  └────────────────────────────────────────────────────┘                     │
│         │                                                                    │
│         │  (Fire-and-Forget - Não bloqueia)                                  │
│         ▼                                                                    │
│  ┌────────────────────────────────────────────────────┐                     │
│  │ BACKGROUND PERSISTENCE (Async)                    │                     │
│  │                                                    │                     │
│  │ Promise.resolve().then(async () => {              │                     │
│  │   await supabase.from("messages").insert()        │                     │
│  │   await updateLastMessageAt()                     │                     │
│  │ })                                                │                     │
│  │                                                    │                     │
│  │ Erros são capturados e mostram toast              │                     │
│  └────────────────────────────────────────────────────┘                     │
│         │                                                                    │
│         ▼                                                                    │
│  ┌────────────────────────────────────────────────────┐                     │
│  │ REALTIME (Confirmação)                            │                     │
│  │                                                    │                     │
│  │ Evento INSERT chega e atualiza:                   │                     │
│  │ - status: "sending" → "sent"                      │                     │
│  │ - Adiciona dados do servidor (sender profile)    │                     │
│  │                                                    │                     │
│  │ Detecção de duplicata por content+timestamp      │                     │
│  └────────────────────────────────────────────────────┘                     │
│                                                                              │
│  TOTAL PERCEBIDO: <50ms (input limpa imediatamente)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementação Detalhada

### FASE 1: Novo Hook `useSendMessageInstant`

**Novo arquivo: `src/hooks/useSendMessageInstant.tsx`**

Substituir a abordagem TanStack Query síncrona por fire-and-forget:

```typescript
export function useSendMessageInstant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const sendInstant = useCallback((params: {
    conversationId: string;
    content: string;
    isInternal?: boolean;
    attachments?: MediaAttachment[];
  }) => {
    // 1. INSTANTÂNEO: Gerar ID e adicionar ao cache
    const localId = crypto.randomUUID();
    const optimisticMessage = {
      id: localId,
      conversation_id: params.conversationId,
      content: params.content,
      sender_type: 'user',
      sender_id: user?.id,
      is_internal: params.isInternal || false,
      status: 'sending',
      created_at: new Date().toISOString(),
      media_attachments: params.attachments || [],
    };

    // 2. Atualizar cache ANTES de qualquer operação async
    queryClient.setQueryData(
      ["messages", params.conversationId],
      (old: any[] = []) => [...old, optimisticMessage]
    );

    // 3. Fire-and-Forget: Persistir em background
    queueMicrotask(async () => {
      try {
        const { error } = await supabase
          .from("messages")
          .insert({
            id: localId, // Usar mesmo ID para evitar duplicata no realtime
            conversation_id: params.conversationId,
            content: params.content,
            sender_type: 'user',
            sender_id: user?.id,
            is_internal: params.isInternal || false,
            channel: 'web_chat',
          });

        if (error) throw error;

        // Update last_message_at (também em background)
        supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", params.conversationId);

      } catch (error) {
        // Marcar como falhou no cache
        queryClient.setQueryData(
          ["messages", params.conversationId],
          (old: any[] = []) => old.map(m => 
            m.id === localId ? { ...m, status: 'failed' } : m
          )
        );
        
        toast({
          title: "Erro ao enviar",
          description: error.message,
          variant: "destructive",
        });
      }
    });

    return localId;
  }, [queryClient, user, toast]);

  return { sendInstant };
}
```

### FASE 2: Atualizar SuperComposer para Web Chat

**Arquivo: `src/components/inbox/SuperComposer.tsx`**

Modificar o fluxo do Web Chat (linhas 374-384):

```typescript
// ANTES:
} else {
  // Web chat - save directly
  const result = await sendMessage.mutateAsync({...}); // BLOQUEANTE!
  sentMessageId = result?.id || null;
}

// DEPOIS:
} else {
  // Web chat - INSTANT send (fire-and-forget)
  sentMessageId = sendInstant({
    conversationId,
    content: messageContent,
    isInternal: false,
  });
  // Não aguarda! Input limpa imediatamente.
}
```

### FASE 3: Melhorar Detecção de Duplicatas no Realtime

**Arquivo: `src/hooks/useMessages.tsx`**

Atualizar o handler de INSERT para usar UUID como identificador:

```typescript
if (payload.eventType === 'INSERT') {
  queryClient.setQueryData(
    ["messages", conversationId],
    (old: any[] = []) => {
      // 1. Verificar por ID real (agora usa UUID)
      const existingIndex = old.findIndex(m => m.id === newMessage.id);
      
      if (existingIndex !== -1) {
        // Mensagem já existe (fire-and-forget já adicionou)
        // Apenas atualizar status para 'sent'
        const updated = [...old];
        updated[existingIndex] = { 
          ...updated[existingIndex], 
          ...newMessage, 
          status: 'sent' 
        };
        return updated;
      }
      
      // 2. Nova mensagem de outro usuário
      return [...old, { ...newMessage, status: 'sent' }];
    }
  );
}
```

### FASE 4: Otimizar ChatWindow (Componente Legacy)

**Arquivo: `src/components/ChatWindow.tsx`**

Aplicar a mesma lógica fire-and-forget para o ChatWindow legado.

### FASE 5: Indicador Visual de Status

**Arquivo: `src/components/MessageStatusIndicator.tsx`**

Já existe e suporta os status necessários. Apenas garantir que:
- `sending` → Relógio animado
- `sent` → Check único
- `failed` → Ícone de erro com botão "Reenviar"

---

## Arquivos a Modificar

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `src/hooks/useSendMessageInstant.tsx` | **NOVO** - Hook fire-and-forget | CRÍTICA |
| `src/components/inbox/SuperComposer.tsx` | Usar `useSendMessageInstant` para Web Chat | CRÍTICA |
| `src/hooks/useMessages.tsx` | Melhorar merge otimista com UUID | ALTA |
| `src/components/ChatWindow.tsx` | Aplicar fire-and-forget para legado | MÉDIA |
| `src/hooks/useSendMessage.tsx` | Manter para backward compatibility | - |

---

## O que é Removido do Caminho Crítico

| Operação | Antes | Depois |
|----------|-------|--------|
| `supabase.insert(messages)` | Síncrono (500-2000ms) | Background |
| `supabase.update(conversations)` | Síncrono (200-500ms) | Background |
| Triggers do banco | Bloqueavam resposta | Não afetam UI |
| Validações pesadas | No caminho | Background |

---

## Fluxo Visual Final

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CHAT HUMANO - TEMPO REAL                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [Usuário digita mensagem]                                                  │
│          │                                                                   │
│          │ <5ms                                                              │
│          ▼                                                                   │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │ OPTIMISTIC UPDATE (INSTANTÂNEO)                                  │      │
│   │                                                                   │      │
│   │  • Gera UUID local                                               │      │
│   │  • Adiciona ao cache com status="sending"                        │      │
│   │  • Input limpa                                                   │      │
│   │  • UI atualiza                                                   │      │
│   │  ─────────────────────────────────────────────────────────────── │      │
│   │  RETORNA AQUI! Usuário pode digitar próxima mensagem            │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│          │                                                                   │
│          │ Fire-and-Forget (não bloqueia)                                   │
│          ▼                                                                   │
│   ┌────────────────────────────┐                                            │
│   │ BACKGROUND                 │                                            │
│   │                            │                                            │
│   │  supabase.insert()         │──────┐                                     │
│   │  update last_message_at    │      │                                     │
│   └────────────────────────────┘      │                                     │
│                                        │                                     │
│                                        ▼                                     │
│   ┌────────────────────────────────────────────────────────────────┐        │
│   │ REALTIME (Confirmação)                                          │        │
│   │                                                                  │        │
│   │  postgres_changes → Atualiza status para "sent"                 │        │
│   │  (Merge otimista por UUID - sem duplicata)                      │        │
│   └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│   TEMPO PERCEBIDO: <50ms                                                    │
│   TEMPO REAL DE PERSISTÊNCIA: 500-2000ms (mas invisível ao usuário)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Garantias de Não-Quebra

1. **Backward Compatibility**: O hook `useSendMessage` original permanece para WhatsApp/Email
2. **Fallback**: Se falhar, mensagem fica com status `failed` e usuário pode reenviar
3. **Realtime Merge**: UUID como ID evita duplicatas mesmo com latência variável
4. **Testes Incrementais**: Aplicar primeiro no Web Chat, depois expandir

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Latência percebida | 1-30 segundos | <50ms |
| Input liberado para digitar | Após DB confirmar | Imediatamente |
| Status visual | Atrasado | Instantâneo ("enviando...") |
| Persistência | Bloqueante | Background |
| Confiabilidade | Igual | Igual (com fallback visual) |
