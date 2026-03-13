

# Correção: Nomes de Contatos Duplicados

## Diagnóstico

Confirmado no banco de dados: **10.624 de 19.853 contatos** (53%) têm `first_name` idêntico ao `last_name`. Exemplo: `first_name = "Ronildo Oliveira"`, `last_name = "Ronildo Oliveira"`.

**Causa raiz**: O CSV de importação provavelmente tem uma coluna "nome" única com o nome completo. O auto-mapping mapeia "nome" para `first_name`, e o usuário pode ter mapeado manualmente a mesma coluna para `last_name`. O sistema não detecta nem corrige essa duplicação.

| Fonte | Total | Duplicados |
|-------|-------|-----------|
| csv_import | 13.427 | 10.041 (75%) |
| kiwify_validated | 1.825 | 559 (31%) |

## Plano de Correção (3 camadas)

### 1. Correção de dados existentes (migration SQL)

Executar uma migration que, para todos os contatos onde `TRIM(first_name) = TRIM(last_name)`:
- Separa o valor em `first_name` no primeiro espaço
- Parte 1 → `first_name`, Parte 2+ → `last_name`
- Se não há espaço (nome único como "Alessandro"), `last_name` fica vazio

```sql
UPDATE contacts
SET 
  first_name = split_part(TRIM(first_name), ' ', 1),
  last_name = CASE 
    WHEN position(' ' in TRIM(first_name)) > 0 
    THEN substring(TRIM(first_name) from position(' ' in TRIM(first_name)) + 1)
    ELSE ''
  END
WHERE TRIM(first_name) = TRIM(last_name)
  AND first_name IS NOT NULL 
  AND first_name != '';
```

### 2. Prevenção na importação CSV (`supabase/functions/bulk-import-contacts/index.ts`)

Na função `sanitizeContact`, adicionar lógica:
- Se `first_name === last_name`, fazer split automático (primeiro nome / resto)
- Se `last_name` está vazio e `first_name` contém espaço, fazer split automático

### 3. Prevenção no Kiwify (`supabase/functions/sync-kiwify-sales/index.ts`)

Na linha 266-267, quando `sale.customer.first_name` retorna o nome completo e é idêntico a `sale.customer.last_name`, aplicar a mesma lógica de split.

### 4. Display defensivo (componentes)

Em `ConversationListItem.tsx` linha 281 e `ContactInfoCard.tsx` linha 133, adicionar helper para evitar repetição visual:

```typescript
function displayName(firstName?: string, lastName?: string): string {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f && l && f === l) return f; // Evita "João João"
  return `${f} ${l}`.trim() || 'Cliente';
}
```

Aplicar este helper nos principais pontos de exibição (ConversationListItem, ContactInfoCard, ContactCard, MessageBubble avatar, ChatWindow).

### Arquivos alterados
1. **Migration SQL** — correção dos 10.624 registros existentes
2. `supabase/functions/bulk-import-contacts/index.ts` — prevenção na importação
3. `supabase/functions/sync-kiwify-sales/index.ts` — prevenção no Kiwify
4. `src/lib/displayName.ts` — novo helper reutilizável
5. `src/components/ConversationListItem.tsx` — usar helper
6. `src/components/ContactInfoCard.tsx` — usar helper
7. `src/components/contacts/ContactCard.tsx` — usar helper

### Impacto
- Corrige 53% dos contatos existentes de uma vez
- Previne recorrência em futuras importações
- Display defensivo para qualquer caso residual

