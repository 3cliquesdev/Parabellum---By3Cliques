

# Fix: Filtro "Somente IA" não funciona nas Encerradas

## Problema

Na aba **Encerradas** (`filter=archived`), aplicar o filtro "Somente IA (sem humano)" ou "Todas da IA" retorna zero resultados.

**Causa**: O filtro `ai_only` exige `ai_mode === 'autopilot' && !assigned_to`. Mas conversas encerradas pela IA autônoma geralmente tiveram `assigned_to` preenchido durante o processo de fechamento, ou tiveram `ai_mode` alterado para `waiting_human` durante handoff. O filtro descarta tudo.

## Correção

**Arquivo**: `src/hooks/useInboxView.tsx` (linhas 191-199)

Ajustar a lógica do filtro `ai_only` para considerar o contexto de conversas encerradas:

```typescript
// AI mode filter
if (filters.aiMode) {
  if (filters.aiMode === 'ai_all') {
    result = result.filter(item => 
      ['autopilot', 'copilot', 'waiting_human'].includes(item.ai_mode)
    );
  } else if (filters.aiMode === 'ai_only') {
    if (scope === 'archived') {
      // Para encerradas: mostrar conversas que foram resolvidas pela IA
      // (autopilot que a IA fechou autonomamente — podem ter assigned_to)
      result = result.filter(item => item.ai_mode === 'autopilot');
    } else {
      // Para ativas: manter lógica original (sem humano atribuído)
      result = result.filter(item => item.ai_mode === 'autopilot' && !item.assigned_to);
    }
  } else {
    result = result.filter(item => item.ai_mode === filters.aiMode);
  }
}
```

A função `applyFilters` já recebe o parâmetro `scope`, basta usá-lo na condição `ai_only`.

## Resultado

- Filtro "Somente IA" nas encerradas mostrará todas as conversas com `ai_mode = autopilot` (resolvidas pela IA)
- Filtro "Todas da IA" continuará funcionando normalmente
- Comportamento nas conversas ativas permanece inalterado

