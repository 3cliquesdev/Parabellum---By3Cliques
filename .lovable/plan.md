

# Diagnóstico: Fluxo cancelado mas não permite iniciar outro

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Causa Raiz

No `useActiveFlowState.ts`, quando o fluxo é cancelado (linha 91), o código chama `invalidateQueries` — isso marca a query como "stale" e agenda um refetch. Porém, o refetch é **assíncrono** e pode levar alguns milissegundos. Se o usuário clicar no FlowPickerButton logo após ver o toast "Fluxo cancelado", o `activeFlow` ainda contém o valor antigo (não-null), e o guard `hasActiveFlow` bloqueia com o erro.

Além disso, `staleTime: 10_000` (10s) pode impedir refetches em certos cenários.

## Solução

Adicionar um **optimistic update** no `cancelFlow`: setar o cache da query para `null` imediatamente antes de invalidar.

### Mudança única em `useActiveFlowState.ts`

Na função `cancelFlow` (linha 90), após o `toast.success`, adicionar `queryClient.setQueryData(queryKey, null)` **antes** do `invalidateQueries`. Isso garante que todos os componentes que consomem essa query (ChatWindow, ActiveFlowIndicator, SuperComposer) vejam `activeFlow = null` instantaneamente.

```typescript
// cancelFlow — após toast.success:
queryClient.setQueryData(queryKey, null);   // ← NOVO: optimistic update
queryClient.invalidateQueries({ queryKey }); // mantém refetch para confirmar
```

### Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — apenas adiciona optimistic update, sem remover lógica |
| Upgrade | Sim — elimina race condition entre cancel e novo início |
| Componentes afetados | Todos que usam `useActiveFlowState` se beneficiam automaticamente |

