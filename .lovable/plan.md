

# Corrigir filtro de Tags no Inbox — Filtros Avançados não funcionam

## Problema

O filtro de tags no popover "Filtros Avançados" **não faz nada**. O usuário seleciona tags (ex: "9.04 Desistência da conversa") mas a lista de conversas não muda.

**Causa raiz**: Desconexão entre o componente de filtros e a lógica de filtragem:

1. `InboxFilterPopover` define `filters.tags: string[]` (array de IDs de tags)
2. `useInboxView` só aceita `tagId?: string` (uma única tag, vinda do URL param `?tag=`)
3. Em `Inbox.tsx` linha 112: `tagId: tagFilter || undefined` — usa apenas o param da URL, **ignora completamente** `filters.tags` do popover

## Correção

### 1. `src/hooks/useInboxView.tsx`
- Alterar `InboxFilters.tagId?: string` para `tags?: string[]` (suporte a múltiplas tags)
- Atualizar `useTagConversationIds` para aceitar array de tag IDs e buscar conversation_ids que tenham **qualquer** das tags selecionadas
- Atualizar `applyFilters` para usar `filters.tags` em vez de `filters.tagId`

### 2. `src/pages/Inbox.tsx`
- Mapear `filters.tags` do popover para o campo `tags` do `inboxViewFilters`:
  ```
  tags: filters.tags.length > 0 ? filters.tags : (tagFilter ? [tagFilter] : undefined)
  ```
  Isso faz o filtro do popover funcionar E mantém compatibilidade com o param de URL `?tag=`

### 3. `src/hooks/useInboxView.tsx` — `useTagConversationIds`
- Aceitar `tags?: string[]` em vez de `tagId?: string`
- Query: `.in('tag_id', tags)` para buscar conversas com qualquer uma das tags selecionadas

Alteração cirúrgica em 2 arquivos, sem impacto em outros filtros.

