

# Plano: Fase 1 + Fase 2 — Fluxo anterior cancela automaticamente + UI reativa

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico Atualizado

Após analisar o backend, descobri que a **Fase 2 já está implementada no backend**. Na linha 662-673 de `process-chat-flow/index.ts`, o manual trigger já deleta todos os estados anteriores (`active`, `waiting_input`, `in_progress`, `cancelled`) antes de criar o novo. Ou seja, o banco já fica limpo.

O problema real é **100% frontend/cache**:

1. **`hasActiveFlow` guard bloqueia** — o `FlowPickerButton` recusa iniciar se `hasActiveFlow=true`, mas o cache ainda mostra o fluxo antigo por causa do `staleTime: 10_000`
2. **`staleTime: 10_000`** — mantém o dado "velho" por até 10 segundos, impedindo refetch mesmo com invalidação em certos cenários

## Mudanças Necessárias

### 1. `useActiveFlowState.ts` — Reduzir `staleTime`

Alterar `staleTime` de `10_000` para `2_000` (2 segundos). Suficiente para evitar spam de requests, mas rápido o bastante para reagir a mudanças.

**Linha 53:** `staleTime: 10_000` → `staleTime: 2_000`

### 2. `FlowPickerButton.tsx` — Remover guard `hasActiveFlow`

Como o backend já limpa estados anteriores automaticamente no manual trigger, o guard frontend é desnecessário e causa o bug. Remover o bloco das linhas 47-50 que impede iniciar novo fluxo quando `hasActiveFlow=true`.

Isso é seguro porque:
- O backend (linha 662-673) já faz `DELETE FROM chat_flow_states WHERE conversation_id = X AND status IN (...)` antes de criar o novo
- Não há risco de múltiplos fluxos simultâneos
- A prop `hasActiveFlow` pode ser mantida na interface mas ignorada (ou removida)

### Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — backend já protegia contra duplicação |
| Upgrade | Sim — elimina bloqueio falso por cache |
| Kill Switch | Não afetado |
| Fluxo nunca mudo | Não afetado |

