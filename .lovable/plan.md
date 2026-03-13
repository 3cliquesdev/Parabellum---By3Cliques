

# Correção: Indicador de Fluxo Ativo Desaparecendo

## Problema

O `useActiveFlowState` só busca flow states com status `in_progress`, `active` ou `waiting_input`. Quando o fluxo termina (status `completed`, `transferred`, `cancelled`), o indicador desaparece completamente — o agente perde a informação de qual fluxo rodou naquela conversa.

## Correção

### `src/hooks/useActiveFlowState.ts`

Alterar a query para buscar o **último flow state** da conversa independente do status. Adicionar o campo `status` ao retorno da interface `ActiveFlow`.

```text
Query atual:   .in("status", ["in_progress", "active", "waiting_input"])
Query nova:    sem filtro de status, pega o mais recente (limit 1, order desc)
```

Adicionar `status` e `completedAt` à interface `ActiveFlow`.

### `src/components/inbox/ActiveFlowIndicator.tsx`

Ajustar a renderização baseada no status do flow state:

| Status | Visual | Botão cancelar |
|--------|--------|----------------|
| `in_progress` / `active` / `waiting_input` | Badge azul "Em andamento" | Sim |
| `completed` | Badge verde "Concluído" | Não |
| `transferred` | Badge amarelo "Transferido" | Não |
| `cancelled` | Badge cinza "Cancelado" | Não |

O nome do fluxo sempre aparece. O botão X só aparece para fluxos ainda ativos.

### Impacto
- Zero breaking changes
- 2 arquivos alterados
- O agente sempre vê qual fluxo está/esteve ativo na conversa

