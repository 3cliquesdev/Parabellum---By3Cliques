

# Fix: Planilha mostrando 2 tags quando só 1 foi adicionada manualmente

## Diagnóstico

A query SQL da RPC `get_commercial_conversations_report` calcula `tags_all` assim:

```sql
SELECT ARRAY_AGG(DISTINCT t.name ORDER BY t.name) AS tags_all
FROM conversation_tags ct
JOIN tags t ON t.id = ct.tag_id
WHERE ct.conversation_id = c.id
-- SEM filtro de categoria!
```

Isso retorna **todas** as tags da conversa, incluindo tags adicionadas automaticamente pelo sistema de alertas SLA (`auto-close-conversations`), que insere tags protegidas na tabela `conversation_tags` + `protected_conversation_tags`.

Então quando o agente adiciona 1 tag manualmente e o sistema SLA adiciona outra automaticamente, a planilha mostra 2.

## Solução

Separar na planilha as tags manuais das automáticas. Duas abordagens possíveis:

**Abordagem escolhida**: Filtrar `tags_all` para excluir tags protegidas (automáticas do SLA), mantendo apenas tags manuais. Adicionar coluna separada para tags automáticas.

### Mudanças

1. **Migration SQL** — Alterar a lateral join de `tags_calc` na RPC `get_commercial_conversations_report`:
   - `tags_all` → apenas tags que **não** estão na tabela `protected_conversation_tags`
   - Novo campo `tags_auto` → tags que **estão** na `protected_conversation_tags`

2. **`src/hooks/useExportConversationsCSV.tsx`** — Adicionar coluna "Tags Automáticas" na planilha usando `tags_auto`

3. **`src/hooks/useExportCommercialConversationsCSV.tsx`** — Mesma separação

