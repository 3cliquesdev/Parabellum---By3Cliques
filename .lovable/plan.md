

# Plano: Corrigir Exibição de Deals Ganhos/Perdidos com Filtros de Data

## Diagnóstico Detalhado

### Contexto do Problema
- **Usuário:** Thaynara da Silva (vendedora - sales_rep)
- **Filtro aplicado:** "Criado: 25/01/2026 - 31/01/2026"
- **Comportamento observado:** Colunas "Ganho" e "Perdido" mostram 0

### Causa Raiz
O sistema está funcionando corretamente, mas há uma **inconsistência de UX**:

| Dados no banco | Filtro atual | Resultado |
|----------------|--------------|-----------|
| Thaynara tem 36 deals OPEN criados no período | `created_at` entre 25-31/jan | 36 deals abertos |
| Thaynara tem 0 deals WON criados no período | `created_at` entre 25-31/jan | 0 deals ganhos |
| Thaynara tem 0 deals LOST criados no período | `created_at` entre 25-31/jan | 0 deals perdidos |

**Expectativa do usuário:** Ver deals que foram **fechados** (ganhos/perdidos) no período  
**Comportamento atual:** Mostra deals que foram **criados** no período

### Problemas Secundários Identificados

1. **Limite de 50 deals no useDeals**: Pode cortar resultados em períodos com muitos deals
2. **Métricas de header inconsistentes**: O componente `useDealsMetrics` filtra corretamente ganhos/perdas por `closed_at`, mas as colunas Ganho/Perdido mostram dados filtrados por `created_at`
3. **Falta de filtro por `closed_at`**: Não existe opção de filtrar por "Data de Fechamento"

---

## Solução Proposta

### 1. Adicionar Filtro "Data de Fechamento" (closedDateRange)

**Arquivo:** `src/hooks/useDeals.tsx`

Adicionar novo campo no tipo `DealFilters`:

```typescript
export interface DealFilters {
  // ... campos existentes ...
  closedDateRange?: DateRange; // NOVO: filtra por closed_at
}
```

Adicionar lógica de filtro na query:

```typescript
// Closed date range (para filtrar ganhos/perdidos)
if (filters.closedDateRange?.from) {
  query = query.gte("closed_at", filters.closedDateRange.from.toISOString());
}
if (filters.closedDateRange?.to) {
  const endDate = new Date(filters.closedDateRange.to);
  endDate.setHours(23, 59, 59, 999);
  query = query.lte("closed_at", endDate.toISOString());
}
```

### 2. Adicionar Campo no Modal de Filtros Avançados

**Arquivo:** `src/components/deals/AdvancedDealFiltersModal.tsx`

Adicionar seletor de "Data de Fechamento" ao lado do "Data de Criação" e "Prev. Fechamento":

```tsx
<div className="space-y-2">
  <Label>Data de Fechamento (Ganhos/Perdidos)</Label>
  <DatePickerWithRange
    date={filters.closedDateRange}
    onSelect={(range) => updateFilters({ closedDateRange: range })}
  />
</div>
```

### 3. Gerar Chip para o Novo Filtro

**Arquivo:** `src/components/ui/active-filter-chips.tsx`

Adicionar na interface:
```typescript
closedDateRange?: { from?: Date; to?: Date };
```

Adicionar geração do chip:
```typescript
if (filters.closedDateRange?.from) {
  const label = filters.closedDateRange.to 
    ? `Fechado: ${formatDate(filters.closedDateRange.from)} - ${formatDate(filters.closedDateRange.to)}`
    : `Fechado desde: ${formatDate(filters.closedDateRange.from)}`;
  chips.push({ key: "closedDateRange", label });
}
```

### 4. Atualizar clearAllFilters e handleRemoveFilterChip

**Arquivo:** `src/pages/Deals.tsx`

```typescript
// Em clearAllFilters
closedDateRange: undefined,

// Em handleRemoveFilterChip
} else if (key === "closedDateRange") {
  setDealFilters({ ...dealFilters, closedDateRange: undefined });
}
```

### 5. Aumentar Limite de Deals para Filtros com Data

**Arquivo:** `src/hooks/useDeals.tsx`

Quando filtros de data estão ativos, aumentar o limite para 200 deals:

```typescript
// Limite dinâmico baseado em filtros ativos
const hasDateFilter = filters?.createdDateRange?.from || 
                      filters?.closedDateRange?.from ||
                      filters?.expectedCloseDateRange?.from;
const limit = hasDateFilter ? 200 : 50;
query = query.limit(limit);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useDeals.tsx` | Adicionar `closedDateRange` no tipo e na query |
| `src/components/deals/AdvancedDealFiltersModal.tsx` | Adicionar campo de Data de Fechamento |
| `src/components/ui/active-filter-chips.tsx` | Adicionar chip para `closedDateRange` |
| `src/pages/Deals.tsx` | Atualizar `clearAllFilters` e `handleRemoveFilterChip` |

---

## Impacto

| Antes | Depois |
|-------|--------|
| Não era possível filtrar por data de fechamento | Filtro "Fechado" disponível para vendas no período |
| Usuário confuso sobre ganhos zerados | Pode escolher filtrar por "Criado" OU "Fechado" |
| Limite fixo de 50 deals cortava resultados | Limite aumentado para 200 quando há filtros de data |
| Nenhuma funcionalidade existente é perdida | Todos os filtros continuam funcionando |

---

## Seção Técnica

### Por que não mudar o comportamento padrão?

Alterar o filtro "Criado" para também afetar `closed_at` quebraria casos de uso existentes onde o usuário quer ver "leads que entraram no período" independente do status atual.

### Sobre o limite de 50 vs 200

O limite de 50 foi implementado para performance em cenários sem filtro. Com filtros de data ativos, o conjunto é naturalmente menor, então 200 é seguro.

### Validação Pós-Deploy

1. Aplicar filtro "Fechado: 01/01/2026 - 31/01/2026"
2. Verificar que coluna "Ganho" mostra deals fechados no período
3. Verificar que chip "Fechado: ..." aparece
4. Clicar em "Limpar Tudo" e confirmar que o filtro é removido
5. Testar como vendedor (sales_rep) para confirmar que só vê seus próprios deals

