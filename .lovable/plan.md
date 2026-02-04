
## Plano: Corrigir Visibilidade de Conversas - Sincronizar Query em useConversations

### Problema Identificado

A contagem está correta (34 conversas em "Suporte Sistema") porque `get-inbox-counts` e `useInboxView` foram atualizados. Porém, a lista de conversas ainda mostra apenas 5 porque:

1. **`useInboxView.tsx`** (CORRETO): Query inclui conversas de colegas do departamento
2. **`useConversations.tsx`** (DESATUALIZADO): Query ainda restringe a conversas não atribuídas

O `Inbox.tsx` prioriza `conversations` (do hook antigo) sobre `inboxItems` (do hook correto) na linha 319-320.

---

### Mudança Necessária

**Arquivo:** `src/hooks/useConversations.tsx` (linhas 159-170)

| Antes | Depois |
|-------|--------|
| `assigned_to.eq.${user.id},and(assigned_to.is.null,department.in.(...))` | `assigned_to.eq.${user.id},department.in.(...),and(assigned_to.is.null,department.is.null)` |

**Query atualizada:**
```javascript
// ANTES (só vê não atribuídas do departamento)
query = query.or(
  `assigned_to.eq.${user.id},and(assigned_to.is.null,department.in.(${departmentIds.join(",")})),and(assigned_to.is.null,department.is.null)`
);

// DEPOIS (vê TODAS do departamento, incluindo de colegas)
query = query.or(
  `assigned_to.eq.${user.id},department.in.(${departmentIds.join(",")}),and(assigned_to.is.null,department.is.null)`
);
```

---

### Arquivos a Modificar

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/hooks/useConversations.tsx` | 162-164 | Alterar query para incluir conversas de colegas do departamento |

---

### Impacto

| Aspecto | Resultado |
|---------|-----------|
| Miguel verá 34 conversas | As mesmas que a contagem mostra |
| Retrocompatível | Sim, apenas expande visibilidade |
| Não afeta outros departamentos | Mantém isolamento |

---

### Por que funcionou no counts mas não na lista

```text
+------------------------+-------------------------------------------+
|  Componente            |  Query usada                              |
+------------------------+-------------------------------------------+
| Sidebar (counts)       | get-inbox-counts → CORRIGIDO              |
| useInboxView           | inbox_view → CORRIGIDO                    |
| useConversations       | conversations → ❌ DESATUALIZADO          |
| Lista final (Inbox)    | Prioriza conversations → ❌ RESTRITO      |
+------------------------+-------------------------------------------+
```

Após a correção:
```text
+------------------------+-------------------------------------------+
| Lista final (Inbox)    | Prioriza conversations → ✅ 34 conversas  |
+------------------------+-------------------------------------------+
```
