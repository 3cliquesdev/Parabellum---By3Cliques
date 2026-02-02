
# Plano: Correção do Filtro de Datas no Relatório de Conversas Comerciais

## Resumo Executivo

Corrigir os problemas de sincronização entre o label do DateRangePicker e o período real selecionado, além de adicionar tratamento de erro visível quando KPIs/Report falharem (evitando "0 silencioso").

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/DateRangePicker.tsx` | Sincronização automática do activePreset + comparação timezone-safe |
| `src/hooks/useCommercialConversationsKPIs.tsx` | Adicionar logs de debug e não mascarar erro |
| `src/hooks/useCommercialConversationsReport.tsx` | Adicionar logs de debug |
| `src/components/reports/commercial/CommercialKPICards.tsx` | Mostrar erro visível na UI |
| `src/components/reports/commercial/CommercialDetailedTable.tsx` | Mostrar erro visível na UI |

---

## Mudanças Detalhadas

### 1. DateRangePicker.tsx - Sincronização Automática

**Problema**: O estado interno `activePreset` não se sincroniza quando o `value` muda externamente.

**Solucao**:
- Implementar `sameDay()` para comparação timezone-safe (evita bugs de toDateString)
- Implementar `detectPresetFromValue()` para identificar qual preset corresponde ao value atual
- Usar `useEffect` para sincronizar activePreset quando value mudar
- Atualizar `getDisplayLabel()` para mostrar datas formatadas quando nao bater com preset

```typescript
// Função timezone-safe para comparar datas por dia
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Detecta automaticamente o preset baseado no value
const detectPresetFromValue = useCallback((range: DateRange | undefined): PresetKey => {
  if (!range?.from || !range?.to) return 'custom';
  
  for (const key of presetOrder) {
    const presetRange = presets[key].getRange();
    if (
      sameDay(range.from, presetRange.from) &&
      sameDay(range.to, presetRange.to)
    ) {
      return key;
    }
  }
  return 'custom';
}, []);

// Sincronizar quando value muda externamente
useEffect(() => {
  const detected = detectPresetFromValue(value);
  if (detected !== activePreset) {
    setActivePreset(detected);
  }
}, [value, detectPresetFromValue, activePreset]);
```

---

### 2. useCommercialConversationsKPIs.tsx - Logs e Erro Real

**Problema**: Erro da RPC é silenciado com `data?.[0] || defaultKPIs`, mascarando falhas.

**Solucao**:
- Adicionar logs de debug com parametros enviados
- Logar erro antes de throw
- Manter throw error para que React Query capture o isError

```typescript
queryFn: async () => {
  console.log('[KPIs] Calling with filters:', {
    p_start: filters.startDate.toISOString(),
    p_end: filters.endDate.toISOString(),
    p_department_id: filters.departmentId,
    p_agent_id: filters.agentId,
    p_status: filters.status,
    p_channel: filters.channel,
  });
  
  const { data, error } = await supabase.rpc("get_commercial_conversations_kpis", {...});

  if (error) {
    console.error('[KPIs] RPC Error:', error);
    throw error;
  }
  
  console.log('[KPIs] Result:', data);
  return (data?.[0] || defaultKPIs) as KPIData;
},
```

---

### 3. useCommercialConversationsReport.tsx - Logs

**Problema**: Falta visibilidade dos parametros enviados para debug.

**Solucao**:
- Adicionar logs de debug similares ao KPIs

```typescript
queryFn: async () => {
  console.log('[Report] Calling with filters:', {
    p_start: filters.startDate.toISOString(),
    p_end: filters.endDate.toISOString(),
    p_department_id: filters.departmentId,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  
  const { data, error } = await supabase.rpc(...);

  if (error) {
    console.error('[Report] RPC Error:', error);
    throw error;
  }
  
  console.log('[Report] Result count:', data?.length);
  return (data || []) as ReportRow[];
},
```

---

### 4. CommercialKPICards.tsx - Erro Visivel

**Problema**: Quando query falha, mostra "0" silencioso.

**Solucao**:
- Adicionar prop `isError` e `error`
- Mostrar mensagem de erro na UI

```tsx
interface CommercialKPICardsProps {
  data: KPIData | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
}

// No componente:
if (isError) {
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p className="text-red-600 dark:text-red-400 text-sm font-medium">
        Erro ao carregar KPIs. Por favor, tente novamente.
      </p>
      {error?.message && (
        <p className="text-red-500 dark:text-red-500 text-xs mt-1">{error.message}</p>
      )}
    </div>
  );
}
```

---

### 5. CommercialDetailedTable.tsx - Erro Visivel

**Problema**: Quando query falha, mostra "Nenhuma conversa encontrada".

**Solucao**:
- Adicionar props `isError` e `error`
- Mostrar mensagem de erro diferenciada

```tsx
interface CommercialDetailedTableProps {
  data: ReportRow[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  // ... rest
}

// No componente, antes do check de data vazia:
if (isError) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversas Detalhadas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">
            Erro ao carregar conversas. Por favor, tente novamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 6. CommercialConversationsReport.tsx - Passar isError

**Ajuste**: Passar isError/error para os componentes filhos.

```tsx
<CommercialKPICards 
  data={kpisQuery.data} 
  isLoading={kpisQuery.isLoading}
  isError={kpisQuery.isError}
  error={kpisQuery.error as Error | null}
/>

<CommercialDetailedTable
  data={reportQuery.data}
  isLoading={reportQuery.isLoading}
  isError={reportQuery.isError}
  error={reportQuery.error as Error | null}
  // ... rest
/>
```

---

## Consistencia do p_end Exclusivo

**Status**: JA IMPLEMENTADO

A pagina `CommercialConversationsReport.tsx` ja faz na linha 74:
```typescript
endDate: addDays(dateRange?.to || endOfMonth(new Date()), 1), // End exclusive
```

Isso garante que quando o usuario seleciona 01/01-31/01, o `p_end` enviado sera 01/02 00:00:00, compativel com o SQL `created_at < p_end`.

---

## Resultado Esperado

1. **Label sincronizado**: Quando usuario seleciona "Mes Passado" ou qualquer preset, o label sempre reflete o periodo real
2. **Erro visivel**: Se KPI ou Report falhar, usuario ve mensagem de erro (nao "0" silencioso)
3. **Debug facilitado**: Logs no console mostram exatamente quais parametros estao sendo enviados
4. **Timezone-safe**: Comparacao por dia evita bugs de horario/timezone
