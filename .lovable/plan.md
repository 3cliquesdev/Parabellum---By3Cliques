

# Tag Universal Sincronizada: Uma Tag, Dois Locais, Tudo Sincronizado

## Objetivo

Quando o usuario escolhe uma tag em qualquer lugar (header ou sidebar), o sistema:
1. Define essa tag na **conversa** (`conversation_tags`) E no **contato** (`customer_tags`)
2. Remove qualquer tag anterior automaticamente (swap)
3. Permite apenas **1 tag por vez** em ambos
4. Qualquer uma das duas vale para liberar o encerramento da conversa

## Arquitetura

```text
+---------------------+       +----------------------+
|  Header (Tag btn)   |       |  Sidebar (Tags)      |
+---------------------+       +----------------------+
         |                              |
         v                              v
  +----------------------------------------------+
  |        Hook: useUniversalTag()               |
  |  - Lê conversation_tags + customer_tags      |
  |  - selectTag(): grava em ambas tabelas       |
  |  - removeTag(): remove de ambas tabelas      |
  |  - currentTag: tag ativa (1 só)              |
  +----------------------------------------------+
         |                    |
         v                    v
  conversation_tags      customer_tags
  (1 registro max)       (1 registro max)
```

## Mudancas

### 1. Novo hook: `src/hooks/useUniversalTag.ts`

Centraliza toda a logica de tag unica sincronizada:

- **Leitura**: busca `conversation_tags` da conversa atual para determinar a tag ativa
- **selectTag(tagId)**: 
  - Remove tag anterior da conversa (`conversation_tags`) se existir
  - Remove tag anterior do contato (`customer_tags`) se existir
  - Insere nova tag na conversa
  - Insere nova tag no contato
- **removeTag()**: remove de ambas as tabelas
- **currentTag**: retorna a tag ativa (ou null)
- Invalida queries de `conversation-tags` e `contact-tags` ao mudar

### 2. Refatorar `src/components/inbox/ConversationTagsSection.tsx`

- Substituir hooks individuais por `useUniversalTag(conversationId, contactId)`
- Receber `contactId` como prop adicional
- Usar `currentTag` do hook universal
- `handleSelectTag` chama `universalTag.select(tagId)`
- Comportamento visual permanece identico (radio-like, 1 badge)

### 3. Refatorar `src/components/inbox/ContactTagsSection.tsx`

- Substituir hooks individuais por `useUniversalTag(conversationId, contactId)`
- Receber `conversationId` como prop adicional
- Trocar Checkbox por radio-like (mesmo visual do header)
- Limitar a 1 tag exibida
- `handleSelectTag` chama `universalTag.select(tagId)`
- Fechar popover apos selecao

### 4. Atualizar `src/components/ContactDetailsSidebar.tsx`

- Passar `conversationId` para `ContactTagsSection`:
  ```
  <ContactTagsSection contactId={contact.id} conversationId={conversation.id} />
  ```

### 5. Atualizar onde `ConversationTagsSection` e usado

- Localizar onde `ConversationTagsSection` e renderizado e garantir que `contactId` tambem e passado como prop

### 6. `CloseConversationDialog.tsx` -- Sem alteracao necessaria

- Ja valida `conversationTags.length > 0` (qualquer tag)
- Como o hook universal sempre sincroniza, ao adicionar tag por qualquer local, `conversation_tags` tera a tag e a validacao passa

### 7. Edge Function `close-conversation` -- Sem alteracao necessaria

- Ja verifica `conversationTags?.length > 0` sem filtro de categoria
- A sincronizacao garante que a tag sempre estara em `conversation_tags`

## Detalhes Tecnicos do Hook Universal

```typescript
// Pseudocodigo do useUniversalTag
function useUniversalTag(conversationId, contactId) {
  const conversationTags = useConversationTags(conversationId)
  const contactTags = useContactTags(contactId)
  const currentTag = conversationTags[0] || null

  async function selectTag(tagId) {
    // 1. Remove tag antiga da conversa (se existir)
    if (currentTag) await removeConversationTag(conversationId, currentTag.id)
    // 2. Remove TODAS tags antigas do contato
    for (tag of contactTags) await removeContactTag(contactId, tag.id)
    // 3. Adiciona nova tag na conversa
    await addConversationTag(conversationId, tagId)
    // 4. Adiciona nova tag no contato
    await addContactTag(contactId, tagId)
    // 5. Invalidar queries
  }

  async function removeTag() {
    if (currentTag) {
      await removeConversationTag(conversationId, currentTag.id)
      await removeContactTag(contactId, currentTag.id)
    }
  }

  return { currentTag, selectTag, removeTag, allTags, isLoading }
}
```

## Resumo

| Componente | Antes | Depois |
|---|---|---|
| Header (ConversationTagsSection) | 1 tag na conversa so | 1 tag sincronizada (conversa + contato) |
| Sidebar (ContactTagsSection) | Multiplas tags no contato, checkbox | 1 tag sincronizada, radio-like |
| Encerramento | So conta conversation_tags | Continua (tag sempre estara la) |
| Hook | Hooks separados | Hook unico `useUniversalTag` |

## Impacto

- Zero regressao: validacao de encerramento continua identica
- Upgrade: tag e universal, usuario escolhe de qualquer lugar
- Sincronizacao bidirecional: header e sidebar sempre mostram a mesma tag
- Backend inalterado: edge function ja aceita qualquer tag

