

# Dashboard de Telemetria AI Decision

## Situação Atual

Os 6 pontos de telemetria `ai_decision` estão **apenas em `console.log`** — não são persistidos em nenhuma tabela. Isso significa que não há como consultá-los via frontend.

Existem duas tabelas candidatas:
- **`ai_decision_logs`** — tem RLS `service_role` only, esquema limitado (decision: reply/handoff/blocked/ignored), não está sendo usada por nenhuma edge function
- **`ai_events`** — já usada amplamente, tem RLS para managers/admins, esquema flexível com `event_type`, `output_json`, `score`

## Plano (3 partes)

### Parte 1: Persistir telemetria na tabela `ai_events`

Em `ai-autopilot-chat/index.ts`, nos 6 pontos de `console.log` com `event: 'ai_decision'`, adicionar um insert na tabela `ai_events` logo após cada `console.log`:

```typescript
// Após cada console.log de ai_decision, inserir:
supabase.from('ai_events').insert({
  entity_type: 'conversation',
  entity_id: conversationId,
  event_type: 'ai_decision_' + reason,  // ex: ai_decision_strict_rag_handoff
  model: 'system',
  score: score,
  output_json: { reason, exitType, fallback_used, articles_found, hasFlowContext },
}).then(() => {}).catch(() => {}); // non-blocking
```

6 inserções, uma para cada ponto de decisão.

### Parte 2: Criar página de Dashboard AI Telemetry

Nova rota `/ai-telemetry` com:

- **KPIs no topo**: Total de decisões (24h), handoffs, fallbacks, violations
- **Gráfico de linha**: Decisões ao longo do tempo (últimas 24h, agrupado por hora)
- **Tabela de eventos recentes**: Últimos 50 eventos com conversation_id, reason, score, timestamp
- **Breakdown por tipo**: Gráfico de barras/pie com distribuição dos 6 tipos de decisão

Componentes:
- `src/pages/AITelemetry.tsx` — página principal
- `src/hooks/useAIDecisionTelemetry.ts` — hook para consultar `ai_events` filtrado por `event_type LIKE 'ai_decision_%'`

### Parte 3: Adicionar rota e menu

- Rota em `App.tsx`: `/ai-telemetry` com permission `ai.manage_personas`
- Item no menu em `routes.ts` no grupo "Automação & AI"

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-autopilot-chat/index.ts` | 6 inserts em `ai_events` nos pontos de telemetria |
| `src/pages/AITelemetry.tsx` | Nova página com KPIs, gráfico e tabela |
| `src/hooks/useAIDecisionTelemetry.ts` | Hook para consultar ai_events |
| `src/App.tsx` | Nova rota `/ai-telemetry` |
| `src/config/routes.ts` | Novo item de menu |

