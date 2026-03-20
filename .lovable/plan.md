

# Correção de Roteamento + Expansão da Telemetria

## 1. Fix: `transition-conversation-state` — Departamento explícito sempre prevalece

**Problema**: Linhas 86, 94, 112 — `if (!conv.department && effectiveDept)` ignora `departmentId` quando a conversa já tem departamento.

**Correção** (3 locais):
```typescript
// De:
if (!conv.department && effectiveDept) updateData.department = effectiveDept;

// Para:
if (departmentId) updateData.department = departmentId;
else if (!conv.department && effectiveDept) updateData.department = effectiveDept;
```

Isso garante que transferências explícitas (Financeiro, CS, etc.) sempre atualizem o departamento.

## 2. Telemetria expandida — Novo painel "Transferências & Roteamento"

### Hook `useAIDecisionTelemetry.ts`
- Adicionar query para eventos `state_transition_*` da tabela `ai_events`
- Extrair de `output_json`: `from_dept`, `to_dept`, `reason`, `agent_id`
- Calcular KPIs: total transferências, mismatches (from_dept == to_dept quando não deveria), tags sem classificação (`ai_close_without_tag`)

### Página `AITelemetry.tsx`
- Novo bloco de KPIs: Transferências totais, Mismatches, Closures proativas, Closures sem tag
- Tabela de transferências recentes: conversa, dept origem → dept destino, tipo transição, tempo
- Filtro por tipo de transição

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/transition-conversation-state/index.ts` | Fix departmentId explícito em 3 cases |
| `src/hooks/useAIDecisionTelemetry.ts` | Buscar eventos `state_transition_*` e `ai_close_*` |
| `src/pages/AITelemetry.tsx` | Painel de transferências com KPIs e tabela |

Deploy: `transition-conversation-state`

