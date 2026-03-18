

# Problema: Todos os contatos mostram "Cliente" no Inbox

## Diagnóstico

493 contatos na base foram importados em massa (2026-03-12 14:28) com `first_name = 'Cliente'` e `last_name = ''`. Todos possuem email e telefone válidos, mas o inbox mostra apenas o nome — que é idêntico para todos.

A função `displayName()` em `src/lib/displayName.ts` retorna `"Cliente"` quando o nome real é exatamente esse. O componente `ConversationListItem` exibe esse nome sem fallback para email/telefone.

## Plano

### 1. Melhorar o `displayName` para usar fallback inteligente

**Arquivo:** `src/lib/displayName.ts`

Adicionar parâmetros opcionais de `phone` e `email`. Quando o nome resultante for genérico ("Cliente", "Desconhecido", "Sem nome"), usar o email (parte antes do @) ou o telefone formatado como fallback.

```
displayName("Cliente", "", "user@gmail.com", "5511999999999")
→ "user" (do email)

displayName("Cliente", "", null, "5511999999999")  
→ "5511999999999"

displayName("João", "Silva")
→ "João Silva" (sem mudança)
```

### 2. Atualizar `ConversationListItem` para passar phone/email

**Arquivo:** `src/components/ConversationListItem.tsx`

Passar `conversation.contacts?.phone` e `conversation.contacts?.email` para `displayName()`.

### 3. Atualizar `Inbox.tsx` para também usar o fallback

**Arquivo:** `src/pages/Inbox.tsx`

No mapeamento do `contact_name` (linha ~204), aplicar a mesma lógica de fallback.

### 4. Backfill dos dados existentes (migration SQL)

Atualizar os 493 contatos com `first_name = 'Cliente'` para usar a parte local do email como nome (capitalizada), quando disponível:

```sql
UPDATE contacts
SET first_name = INITCAP(SPLIT_PART(email, '@', 1))
WHERE first_name = 'Cliente' AND email IS NOT NULL AND email != '';
```

Depois, sincronizar o `inbox_view`:

```sql
UPDATE inbox_view iv
SET contact_name = COALESCE(
  NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), ''),
  c.phone, 'Sem nome'
)
FROM contacts c
WHERE iv.contact_id = c.id;
```

### Resultado esperado
- Contatos importados passam a mostrar nome derivado do email (ex: "Suportelojavichara" em vez de "Cliente")
- Fallback na UI para email/telefone quando o nome é genérico
- Thaynara consegue distinguir cada conversa na lista

### Arquivos a alterar
- `src/lib/displayName.ts`
- `src/components/ConversationListItem.tsx`
- `src/pages/Inbox.tsx`
- 1 migration SQL (backfill de dados)

