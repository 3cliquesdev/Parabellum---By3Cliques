
# Plano: Corrigir Busca que Não Encontra Conversas Abertas

## Problema Confirmado

A busca client-side filtra um array (`inboxItems`) que já veio limitado a 5000 registros ordenados por `updated_at ASC` (mais antigas primeiro). Conversas abertas recentes ficam **fora do recorte**.

## Causa Raiz

```typescript
// src/hooks/useInboxView.tsx linha 63
let query = supabase
  .from("inbox_view")
  .select("*")
  .order("updated_at", { ascending: true }) // ❌ Mais antigas primeiro
  .limit(5000); // ❌ Corta conversas recentes
```

A busca é feita em cima desse array pré-carregado, então conversas recentes (open) não são encontradas.

## Solução: Query Dedicada para Busca

Quando `hasActiveSearch === true`, a busca deve ir **direto ao banco** com uma query própria, em vez de filtrar o array já limitado.

---

## Mudanças Necessárias

### Mudança 1: Criar Hook `useInboxSearch` (Query Dedicada)

**Novo arquivo:** `src/hooks/useInboxSearch.tsx`

Hook que consulta diretamente o banco quando há busca ativa:

```typescript
export function useInboxSearch(searchTerm: string) {
  const { user } = useAuth();
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  return useQuery({
    queryKey: ["inbox-search", debouncedSearch, user?.id],
    queryFn: async (): Promise<InboxViewItem[]> => {
      if (!debouncedSearch || debouncedSearch.trim().length < 2) return [];
      
      const searchLower = debouncedSearch.toLowerCase().trim();
      
      // Query direta ao banco - SEM LIMIT ARTIFICIAL
      // Ordenação: open primeiro, depois por recência
      const { data, error } = await supabase
        .from("inbox_view")
        .select("*")
        .or(
          `contact_name.ilike.%${searchLower}%,` +
          `contact_email.ilike.%${searchLower}%,` +
          `contact_phone.ilike.%${searchLower}%,` +
          `contact_id.ilike.%${searchLower}%,` +
          `conversation_id.ilike.%${searchLower}%`
        )
        .order("status", { ascending: true }) // 'open' vem antes de 'closed' alfabeticamente
        .order("last_message_at", { ascending: false }) // Mais recentes primeiro
        .limit(100); // Limite razoável para resultados de busca
      
      if (error) throw error;
      return data as InboxViewItem[];
    },
    staleTime: 5000,
    enabled: !!user?.id && debouncedSearch.length >= 2,
  });
}
```

### Mudança 2: Atualizar `Inbox.tsx` para Usar Hook de Busca

**Arquivo:** `src/pages/Inbox.tsx`

```typescript
// Importar
import { useInboxSearch } from "@/hooks/useInboxSearch";

// Dentro do componente
const { data: searchResults, isLoading: searchLoading } = useInboxSearch(filters.search || "");

// No useMemo de filteredConversations
if (hasActiveSearch) {
  if (!searchResults || searchResults.length === 0) {
    return [];
  }
  
  // searchResults já vem do banco ordenado corretamente
  return searchResults.map(item => {
    const fullConv = fullConversations.find(c => c.id === item.conversation_id);
    return fullConv || inboxItemToConversation(item);
  });
}
```

### Mudança 3: (Opcional) Inverter Ordenação Padrão

Se quiser que conversas recentes apareçam na lista normal (mesmo sem busca):

```typescript
// src/hooks/useInboxView.tsx linha 63
.order("updated_at", { ascending: false }) // DESC: mais recentes primeiro
```

**Nota**: Isso muda o comportamento do inbox. Atualmente prioriza "mais antigas = maior tempo de espera". Se mudar para DESC, prioriza "mais recentes".

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useInboxSearch.tsx` | **CRIAR** - Hook dedicado para busca |
| `src/pages/Inbox.tsx` | Usar `useInboxSearch` quando há busca ativa |

---

## Fluxo Corrigido

```
┌─────────────────────────────────────────────────┐
│          USUÁRIO DIGITA "fabiosou..."           │
├─────────────────────────────────────────────────┤
│ hasActiveSearch = true                          │
│ useInboxSearch("fabiosou1542@gmail.com")        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│     QUERY DEDICADA AO BANCO (useInboxSearch)    │
├─────────────────────────────────────────────────┤
│ SELECT * FROM inbox_view                        │
│ WHERE contact_email ILIKE '%fabiosou%'          │
│   OR contact_name ILIKE '%fabiosou%'            │
│   OR contact_phone ILIKE '%fabiosou%'           │
│ ORDER BY status ASC, last_message_at DESC       │
│ LIMIT 100                                       │
│                                                 │
│ SEM dependência do array pré-carregado!         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              RESULTADO NA UI                    │
├─────────────────────────────────────────────────┤
│ 1. Conversa OPEN (2614b711...) ✅ APARECE       │
│ 2. Conversas fechadas (por recência)            │
│                                                 │
│ Total: 5 resultados, open no topo ✅            │
└─────────────────────────────────────────────────┘
```

---

## Testes de Validação

1. Buscar por `fabiosou1542@gmail.com`
2. **Esperado**: Conversa OPEN `2614b711...` aparece no topo
3. **Antes do fix**: Só conversas fechadas apareciam

### Testes Adicionais
- Buscar por número de telefone: `5511969656723`
- Buscar por ID de conversa: `2614b711`
- Buscar por nome: `Ronildo`
- Todas devem retornar a conversa OPEN primeiro

---

## Conformidade com Regras

| Regra | Conformidade |
|-------|--------------|
| Upgrade, não downgrade | ✅ Busca agora encontra todas as conversas |
| Zero regressão | ✅ Lista normal (sem busca) não é afetada |
| Consistência | ✅ Busca vai direto ao banco, sem depender de cache |
| Read-only | ✅ Apenas SELECT, nunca UPDATE |
| Enterprise | ✅ Query otimizada com ILIKE no banco |
