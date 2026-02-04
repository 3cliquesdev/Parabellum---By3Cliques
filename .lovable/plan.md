

# Plano: Corrigir Lista Vazia do Inbox (Filtro de Status no SQL)

## Diagnóstico

### Problema Identificado
A lista do Inbox aparece vazia mesmo com badges mostrando números corretos.

### Causa Raiz
A query em `useInboxView` busca 500 registros ordenados por `updated_at ASC` (mais antigos primeiro), **sem filtrar por status**. Como existem 3142 conversas fechadas (mais antigas), as 500 primeiras buscadas são todas `closed`. O filtro `status !== 'closed'` é aplicado DEPOIS no JavaScript, resultando em 0 conversas.

**Fluxo atual quebrado:**
```
SQL: SELECT * FROM inbox_view ORDER BY updated_at ASC LIMIT 500
     → Retorna 500 conversas (todas 'closed' porque são mais antigas)
JS:  filteredConversations.filter(c => c.status !== 'closed')
     → Retorna 0 conversas
```

## Solução

Adicionar filtro `.neq("status", "closed")` **ANTES do LIMIT** na query SQL para que as 500 conversas retornadas sejam todas ativas.

**Fluxo corrigido:**
```
SQL: SELECT * FROM inbox_view WHERE status != 'closed' ORDER BY updated_at ASC LIMIT 500
     → Retorna 500 conversas (todas 'open')
JS:  Nenhum filtro necessário
     → 128 conversas ativas exibidas
```

---

## Arquivos a Modificar

### 1. `src/hooks/useInboxView.tsx`

**Linha ~60-64** - Adicionar filtro de status na query:

```typescript
let query = supabase
  .from("inbox_view")
  .select("*")
  .neq("status", "closed")  // ← ADICIONAR ESTA LINHA
  .order("updated_at", { ascending: true })
  .limit(500);
```

**Justificativa:**
- O filtro é aplicado NO BANCO, não no JavaScript
- As 500 primeiras serão conversas ativas
- Mantém a ordem de prioridade (mais antigas primeiro)
- Performance: índice em `status` já existe

### 2. Caso Especial: Filtro "Encerradas"

Para o filtro `archived` funcionar, precisamos de uma query separada ou lógica condicional.

**Opção A (mais simples):** Quando `filter === 'archived'`, inverter a lógica:

```typescript
// No fetchInboxData, receber um parâmetro includeClosedOnly
async function fetchInboxData(options: FetchOptions = {}): Promise<InboxViewItem[]> {
  const { cursor, userId, role, departmentIds, includeClosedOnly = false } = options;

  let query = supabase
    .from("inbox_view")
    .select("*");

  // Filtro de status baseado no contexto
  if (includeClosedOnly) {
    query = query.eq("status", "closed");
  } else {
    query = query.neq("status", "closed");
  }
  
  query = query.order("updated_at", { ascending: true }).limit(500);
  // ... resto da lógica
}
```

**Opção B (hook dedicado):** Criar `useArchivedInboxItems` similar aos outros hooks especializados.

**Recomendação:** Opção A é suficiente e mantém a simplicidade.

---

## Impacto

| Antes | Depois |
|-------|--------|
| Lista vazia em Todas/IA/Humano | 128 conversas ativas visíveis |
| Filtro "Minhas" sempre zerado | Mostra conversas atribuídas |
| Badges mostram números, lista vazia | Badges e lista sincronizados |

---

## Seção Técnica

### Por que a ordem era ASC?
A ordem `updated_at ASC` (mais antigas primeiro) é intencional para priorização SLA - conversas esperando há mais tempo aparecem no topo.

### Por que o limite de 500?
Reduzido de 5000 para 500 durante período de stress de performance. Pode ser aumentado após a estabilização do RLS.

### O filtro `applyFilters` ainda é necessário?
Sim, para outros filtros client-side (channels, dateRange, tags). Mas o filtro de status agora é redundante e pode ser removido como otimização futura.

---

## Validação Pós-Deploy

1. Acessar `/inbox?filter=all` → deve mostrar conversas abertas
2. Acessar `/inbox?filter=ai_queue` → deve mostrar 58 conversas em autopilot
3. Acessar `/inbox?filter=human_queue` → deve mostrar 70 conversas
4. Acessar `/inbox?filter=archived` → deve mostrar conversas fechadas
5. Console sem erros

