

# Unificar tags: 1 tag por conversa, manual substitui automática

## Diagnóstico

O hook `useUniversalTag.ts` já implementa lógica de "1 tag por conversa" — remove a tag atual antes de adicionar nova. Porém:

1. **`selectTag`** só remove `conversationTags[0]` (a primeira tag). Se o sistema automático adicionou uma tag protegida, ela **não é removida** porque pode ser uma segunda entrada.
2. **`useRemoveConversationTag`** bloqueia remoção de tags protegidas (linhas 208-218 em `useTags.tsx`), impedindo que a substituição funcione.
3. **RPC do relatório** separa tags em 2 colunas (`tags_all` e `tags_auto`), quando deveria ser 1 coluna só.

## Mudanças

### 1. `src/hooks/useUniversalTag.ts` — Remover TODAS as tags ao selecionar nova
- No `selectTag`, em vez de remover apenas `currentTag`, deletar **todas** as `conversation_tags` da conversa (incluindo protegidas)
- Também limpar entradas na `protected_conversation_tags` para a conversa, permitindo que a tag manual prevaleça

### 2. `src/hooks/useTags.tsx` — Remover bloqueio de tags protegidas
- Na função `useRemoveConversationTag`, remover a verificação de `protected_conversation_tags` que impede remoção. Agora qualquer tag pode ser removida/substituída pelo agente.

### 3. Migration SQL — Unificar `tags_all` na RPC
- Alterar `get_commercial_conversations_report` para voltar a um único `ARRAY_AGG(DISTINCT t.name)` sem filtro de `protected_conversation_tags`
- Remover campo `tags_auto` do retorno

### 4. Hooks de exportação — Remover coluna "Tags Automáticas"
- `src/hooks/useExportConversationsCSV.tsx`: remover linha `"Tags Automáticas"`
- `src/hooks/useExportCommercialConversationsCSV.tsx`: mesma remoção

