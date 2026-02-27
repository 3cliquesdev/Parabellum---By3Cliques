

# Fix: Busca por protocolo no Inbox

## Problema

O campo `conversation_id` na tabela `inbox_view` é do tipo `UUID`. O PostgREST **não suporta** `.ilike()` em colunas UUID — a query falha silenciosamente e retorna vazio.

Linha 103 do `useInboxSearch.tsx`:
```
.ilike("conversation_id", `${cleanId}%`)  // ❌ UUID não suporta ILIKE
```

Confirmado: `SELECT conversation_id FROM inbox_view WHERE conversation_id::text ILIKE '9bb95b7d%'` retorna resultado, mas via PostgREST `.ilike()` em UUID falha.

## Solução

### 1. Migration: Adicionar coluna `short_id` (TEXT) na `inbox_view`

- Adicionar coluna `short_id TEXT` na tabela `inbox_view`
- Backfill com `LEFT(conversation_id::text, 8)`
- Criar índice `idx_inbox_view_short_id` para busca rápida
- Atualizar triggers de INSERT e UPDATE para popular `short_id` automaticamente

### 2. Frontend: Usar `.ilike("short_id", ...)` no `useInboxSearch.tsx`

- Alterar a busca de short_id (linha 100-108) para usar a nova coluna `short_id` em vez de `conversation_id`
- `.ilike("short_id", `${cleanId}%`)` funciona porque `short_id` é TEXT

