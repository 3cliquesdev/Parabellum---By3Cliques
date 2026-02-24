
# Corrigir Validacao de Tags ao Encerrar Conversa

## Problema

A validacao de tags obrigatorias ao encerrar conversa aceita **qualquer tag**, independente da categoria. Se o usuario adicionar uma tag pessoal (categoria "customer", "interesse", "fonte", etc.) na conversa, o sistema considera a exigencia cumprida e permite encerrar. O correto e exigir pelo menos uma tag da categoria **"conversation"**.

Alem disso, o encerramento em lote (`useBulkCloseConversations`) ignora completamente a validacao de tags.

## Alteracoes

### 1. Filtrar por categoria "conversation" no `useConversationTags` usado pelo dialog

**Arquivo:** `src/components/CloseConversationDialog.tsx`

- Alterar a logica de `hasTags` para verificar se existe pelo menos uma tag com `category === "conversation"` entre as tags da conversa
- O hook `useConversationTags` ja retorna o campo `category` no select (`tag:tags(id, name, color, category)`)
- Filtrar: `const hasConversationTags = conversationTags.some(t => t.category === "conversation")`
- Usar `hasConversationTags` ao inves de `hasTags` na variavel `missingTags`
- Atualizar o texto do alerta para esclarecer que sao tags de conversa (nao pessoais)

### 2. Adicionar validacao de tags no encerramento em lote

**Arquivo:** `src/hooks/useBulkCloseConversations.tsx`

- Antes de encerrar, consultar `conversation_tags` com JOIN em `tags` filtrando `category = 'conversation'` para cada conversa
- Identificar conversas sem tags de conversa
- Se `tagsRequired` estiver ativo e houver conversas sem tags: bloquear e retornar erro com lista das conversas pendentes
- Receber `tagsRequired` como parametro da mutation

### 3. Propagar validacao no Inbox (bulk close)

**Arquivo:** `src/pages/Inbox.tsx`

- Passar `tagsRequired` (do hook `useConversationCloseSettings`) para a logica de bulk close
- Exibir toast informando quais conversas nao puderam ser encerradas por falta de tags

## Impacto

- Zero regressao: tags pessoais continuam sendo exibidas normalmente na conversa
- Upgrade de governanca: so tags de categoria "conversation" satisfazem a exigencia
- Encerramento em lote passa a respeitar a mesma regra do encerramento individual
- Backend (Edge Function `close-conversation`) nao precisa de alteracao -- a validacao e feita no frontend antes de chamar
