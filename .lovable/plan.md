

# Auditoria Enterprise: Inbox Performance

## Diagnostico Atual

| Criterio Enterprise | Status | Detalhe |
|---|---|---|
| Header instantaneo (dados do inbox_view) | PARCIAL | O `inboxItemToConversation` ja converte dados, mas o ChatWindow faz queries adicionais antes de renderizar o header |
| Skeleton para mensagens | OK | `MessageSkeleton` ja e exibido durante loading |
| placeholderData/keepPreviousData | NAO | `useMessages` nao usa nenhum dos dois - ao trocar conversa, o cache limpa e mostra skeleton |
| Limite de 50 mensagens | NAO | Busca com `.limit(10000)` - carrega TUDO de uma vez |
| Select minimo de colunas | NAO | Usa `select(*)` com joins (profiles, media_attachments) |
| Paginacao infinita (scroll up) | NAO | Nao existe - carrega tudo no primeiro fetch |
| Prefetch onHover na lista | NAO | ConversationListItem nao faz prefetch de mensagens |
| Cancelamento (AbortController) | NAO | Nao usa signal - troca rapida causa race condition |
| Indice `messages(conversation_id, created_at DESC)` | OK | `idx_messages_conversation_created` ja existe |
| Polling adaptativo | PARCIAL | 3s aba visivel / 10s background - mas 3s com 10k mensagens e pesado |

## Gaps Criticos (o que falta para enterprise)

### 1. Query de mensagens carrega TUDO (10.000 rows)
Impacto direto no delay de ~5s. Uma conversa com 200+ mensagens transfere centenas de KB desnecessariamente.

### 2. Sem prefetch na lista de conversas
Ao clicar, comeca do zero. O hover/focus na lista deveria pre-carregar as ultimas 50 mensagens.

### 3. Sem keepPreviousData
Ao trocar de conversa, a UI pisca (skeleton) mesmo que os dados anteriores pudessem ser mantidos visualmente.

### 4. Sem cancelamento de requests
Trocar rapido de conversa acumula requests pendentes que podem resolver fora de ordem.

### 5. Select muito amplo
`select(*)` traz todas as colunas da tabela messages, incluindo metadata, campos raramente usados.

## Plano de Implementacao

### Fase 1: Otimizar query de mensagens (maior impacto)

**Arquivo: `src/hooks/useMessages.tsx`**

- Reduzir `.limit(10000)` para `.limit(50)`
- Mudar order para `desc` e reverter no frontend
- Reduzir select para colunas essenciais:
  ```
  id, content, created_at, sender_type, sender_id, is_ai_generated, 
  is_internal, attachment_url, attachment_type, status, metadata, 
  external_id, client_message_id, provider_message_id, channel,
  sender:profiles!sender_id(id, full_name, avatar_url, job_title),
  media_attachments(id, storage_path, storage_bucket, mime_type, 
    original_filename, file_size, status, waveform_data, duration_seconds)
  ```
- Adicionar `keepPreviousData` para evitar flicker ao trocar conversa
- Adicionar AbortController via `signal` do React Query

### Fase 2: Paginacao infinita (scroll up para historico)

**Arquivo: `src/hooks/useMessages.tsx`**

- Converter para `useInfiniteQuery` com cursor baseado em `created_at`
- `getNextPageParam` retorna o `created_at` da mensagem mais antiga da pagina
- Direcao: carregar mensagens MAIS ANTIGAS ao scrollar para cima
- Manter Realtime INSERT no cache da primeira pagina (mais recente)

**Arquivo: `src/components/ChatWindow.tsx`**

- Adicionar `IntersectionObserver` no topo do scroll para trigger de "load more"
- Preservar posicao de scroll ao carregar paginas antigas (scroll anchoring)

### Fase 3: Prefetch onHover na lista

**Arquivo: `src/components/ConversationListItem.tsx`**

- Adicionar `onMouseEnter` que faz `queryClient.prefetchQuery` das ultimas 50 mensagens
- Limitar a 1 prefetch por item (flag `hasPrefetched`)
- Debounce de 150ms para evitar prefetch em scroll rapido

**Arquivo: `src/components/ConversationList.tsx`**

- Passar `queryClient` via prop ou contexto para o item

### Fase 4: Cancelamento e race conditions

**Arquivo: `src/hooks/useMessages.tsx`**

- React Query ja fornece `signal` no `queryFn` - basta captura-lo:
  ```typescript
  queryFn: async ({ signal }) => {
    const { data, error } = await supabase
      .from("messages")
      .select(...)
      .abortSignal(signal)
  ```
- Garantir que `queryKey: ["messages", conversationId]` ja isola por conversa (OK - ja faz isso)

## Compatibilidade com Realtime

- O Realtime (INSERT/UPDATE/DELETE handlers) continua funcionando identico
- Novas mensagens sao adicionadas via `setQueryData` no cache da pagina mais recente
- O catch-up mechanism permanece inalterado
- O polling adaptativo continua como safety net (mas agora com payload 50x menor)

## Impacto esperado

| Metrica | Antes | Depois |
|---|---|---|
| Payload inicial | ~200KB (10k msgs) | ~15KB (50 msgs) |
| Tempo de renderizacao | ~3-5s | <500ms |
| Flicker ao trocar conversa | Sim (skeleton) | Nao (keepPreviousData) |
| Prefetch no hover | Nao | Sim (top 10 visiveis) |
| Cancelamento de requests | Nao | Sim (AbortController) |

## Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useMessages.tsx` | Limite 50, select otimizado, keepPreviousData, AbortController, useInfiniteQuery |
| `src/components/ChatWindow.tsx` | IntersectionObserver para scroll up, flatten pages |
| `src/components/inbox/MessagesWithMedia.tsx` | Adaptar para receber array flat (sem mudanca de API) |
| `src/components/ConversationListItem.tsx` | Prefetch onMouseEnter |
| `src/components/ConversationList.tsx` | Passar queryClient para items |

## Riscos e mitigacao

- **Historico incompleto**: Mitigado pela paginacao infinita - usuario pode scrollar para carregar mais
- **Realtime com infinite query**: Novas mensagens sao adicionadas na primeira pagina (mais recente) - sem conflito
- **Catch-up**: Continua buscando mensagens apos `lastMessageTimestamp` - funciona igual com 50 ou 10000

