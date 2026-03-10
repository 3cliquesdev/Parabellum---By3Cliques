

# Corrigir filtro "Não atribuídas" — badge mostra 11 mas lista mostra 0

## Causa raiz

**Mismatch entre contagem e filtragem:**

- **Badge (get-inbox-counts)** conta: `assigned_to IS NULL AND status != 'closed'` → **inclui conversas em autopilot**
- **Lista (Inbox.tsx:306)** filtra: `!assigned_to && status !== 'closed' && ai_mode !== 'autopilot'` → **exclui autopilot**

As 11 conversas "não atribuídas" são provavelmente conversas em modo **autopilot** (IA atendendo sozinha, sem agente). O badge conta elas, mas a lista corretamente exclui. O badge está errado.

## Correção

### `supabase/functions/get-inbox-counts/index.ts` (linhas 203-205)

Adicionar `.neq("ai_mode", "autopilot")` na query de unassigned:

```typescript
// ANTES:
applyVisibility(supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }))
  .neq("status", "closed")
  .is("assigned_to", null),

// DEPOIS:
applyVisibility(supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }))
  .neq("status", "closed")
  .is("assigned_to", null)
  .neq("ai_mode", "autopilot"),
```

Isso alinha o badge com a definição: **"Não atribuídas = conversas sem agente que precisam de atenção humana (excluindo autopilot)"**.

Alteração em **1 arquivo** (edge function), deploy automático.

