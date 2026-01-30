
# Plano: Forçar Limite Mínimo de 30 Conversas por Agente

## Problema Identificado

O dispatcher está marcando **"All agents at capacity"** porque:

| Agente | Dept | Chats Atuais | Limite Atual | Status |
|--------|------|--------------|--------------|--------|
| Juliana Alves | Suporte Pedidos | 10 | 10 (default) | ❌ "At capacity" |
| Miguel Fedes | Suporte Pedidos | 65 | 10 (default) | ❌ "At capacity" |

O time **Suporte Nacional** (onde está Juliana) não tem `max_concurrent_chats` configurado:
```sql
-- Resultado atual
team: Suporte Nacional
max_concurrent_chats: NULL  -- Usa default 10
```

Como resultado:
- Juliana tem 10 chats → já está no limite (10)
- 4 jobs pendentes para "Suporte Pedidos" ficam travados
- Fila só cresce, ninguém recebe novas conversas

## Solução: Forçar Mínimo de 30 no Dispatcher

Modificar a função `findEligibleAgent` em `dispatch-conversations/index.ts` para:

1. **Default 30** em vez de 10 quando não há configuração
2. **Mínimo 30** mesmo que um time configure menos (ex.: 10)

### Código Atual (linha 371)
```typescript
const maxChats = tm.team?.team_settings?.max_concurrent_chats ?? 10;
```

### Código Novo
```typescript
// D5: Forçar mínimo de 30 conversas por agente para alta demanda
const configuredMax = tm.team?.team_settings?.max_concurrent_chats;
const maxChats = Math.max(configuredMax ?? 30, 30);
```

### Também ajustar o fallback (linha 398)
```typescript
// Atual
max_chats: capacityMap.get(p.id) ?? 10,

// Novo
max_chats: capacityMap.get(p.id) ?? 30, // Fallback para 30
```

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dispatch-conversations/index.ts` | Linhas 371 e 398: `min 30` |

## Impacto Esperado

### Antes (Bug)

| Agente | Chats | Limite | Resultado |
|--------|-------|--------|-----------|
| Juliana | 10 | 10 | ❌ "At capacity" |
| Miguel | 65 | 10 | ❌ "At capacity" |
| *Fila pendente* | - | - | **Cresce infinitamente** |

### Depois (Corrigido)

| Agente | Chats | Limite | Resultado |
|--------|-------|--------|-----------|
| Juliana | 10 | **30** | ✅ 20 slots livres |
| Miguel | 65 | **30** | ❌ Ainda acima do limite |
| *Fila pendente* | - | - | **Cai para Juliana** |

## Compatibilidade

- ✅ Mantém configurações de times existentes como "teto" (se > 30)
- ✅ Força mínimo de 30 para evitar gargalos
- ✅ Não afeta roles/permissões existentes
- ✅ Cron executará em até 1 minuto e distribuirá automaticamente

## Observação: Miguel com 65 chats

Miguel está muito acima do limite (65 vs 30). Isso pode indicar:
1. Conversas antigas não fechadas
2. Redistribuição manual anterior

Isso não impede o fix - Juliana vai receber as novas porque ela está em 10 (< 30).

---

## Seção Técnica

### Alterações no Código

```typescript
// supabase/functions/dispatch-conversations/index.ts

// Linha 371: Dentro do loop de teamMembers
for (const tm of (teamMembers || []) as any[]) {
  // D5: Forçar mínimo de 30 conversas por agente
  const configuredMax = tm.team?.team_settings?.max_concurrent_chats;
  const maxChats = Math.max(configuredMax ?? 30, 30);
  capacityMap.set(tm.user_id, maxChats);
}

// Linha 398: Fallback no map de agentes
.map((p: any) => ({
  id: p.id,
  full_name: p.full_name,
  max_chats: capacityMap.get(p.id) ?? 30, // Fallback para 30
  active_chats: activeChatsMap.get(p.id) ?? 0,
  last_status_change: p.last_status_change,
}))
```

### Fluxo Corrigido

```text
Conversa entra em waiting_human
        ↓
Job criado em conversation_dispatch_jobs
        ↓
dispatch-conversations (CRON a cada 1 min)
        ↓
findEligibleAgent: dept=Suporte Pedidos
        ↓
Juliana: 10 chats < 30 (MIN) → ELEGÍVEL ✅
        ↓
Atribuição: assigned_to=Juliana, ai_mode='copilot'
        ↓
Juliana abre inbox → Conversa aparece com composer habilitado ✅
```
