

## Plano: Filtrar Tempo Médio de Resolução por Departamento e Agente

### Problema
O KPI "Tempo Médio de Atendimento" (MTTR) no dashboard de Suporte é calculado globalmente, sem possibilidade de filtrar por departamento ou agente.

### Solução

**1. Nova RPC no banco: `get_support_metrics_filtered`**
- Mesma lógica de `get_support_metrics_consolidated`, mas aceita parâmetros opcionais `p_department_id UUID` e `p_agent_id UUID`
- Filtra `conversations.department` e `conversations.assigned_to` quando fornecidos
- Retorna `avgFRT`, `avgMTTR`, `avgCSAT`, `totalRatings`

**2. Atualizar `SupportKPIsWidget.tsx`**
- Adicionar dois `<Select>` dropdowns acima dos cards: Departamento e Agente
- Usar `useDepartments({ activeOnly: true })` e `useProfiles()` para popular os selects
- Passar os filtros selecionados para o hook

**3. Atualizar `useSupportMetrics.tsx`**
- Aceitar parâmetros opcionais `departmentId` e `agentId`
- Chamar a nova RPC `get_support_metrics_filtered` em vez de `get_support_metrics_consolidated`
- Incluir os filtros na `queryKey`

### Arquivos afetados
- **Migration SQL** — criar `get_support_metrics_filtered`
- **`src/hooks/useSupportMetrics.tsx`** — adicionar params de filtro
- **`src/components/widgets/SupportKPIsWidget.tsx`** — adicionar dropdowns de Departamento e Agente

