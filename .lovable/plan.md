

# Auditoria Final — Estado dos 5 Fixes

## Checklist Completo

| # | Fix | Arquivo | Status |
|---|------|---------|--------|
| 1a | `userMessage` → `customerMessage` em webhooks | `meta-whatsapp-webhook` | ✅ Zero ocorrências |
| 1b | `userMessage` → `customerMessage` em webhooks | `handle-whatsapp-event` | ✅ Zero ocorrências |
| 1c | `userMessage` residual em `ai-autopilot-chat` L3209 | `ai-autopilot-chat` | ✅ CORRETO — `process-chat-flow` L776 espera `userMessage`, contrato diferente |
| 1d | Validação 400 para `customerMessage` vazio | `ai-autopilot-chat` L1461-1471 | ✅ Implementado |
| 2a | Guarantee block no handoff | `transition-conversation-state` L161-181 | ✅ Implementado |
| 2b | Reconciliação de órfãs | `dispatch-conversations` L64-100 | ✅ Implementado |
| 2c | Requeue de escalated | `dispatch-conversations` L132-136 | ✅ Implementado |
| 3a | Queue hygiene (purge) | `dispatch-conversations` L102-116 | ⚠️ Filtra apenas `closed`, falta `resolved` e `finished` |
| 3b | Filtro de fila (posição) | `route-conversation` L797 | ✅ Filtra `closed`, `resolved`, `finished` |
| 4 | Telemetria `ai_decision` (6 pontos) | `ai-autopilot-chat` | ✅ 6/6 confirmados |
| 5a | Auth do health-check-ai | `health-check-ai` L18-22 | ✅ Retorna 401 corretamente |
| 5b | Stale queue metric | `health-check-ai` L69 | ⚠️ Filtra apenas `closed`, falta `resolved` e `finished` |

## 2 Pendências Encontradas

### 1. `dispatch-conversations/index.ts` L107
**Atual:** `.in('conversations.status', ['closed'])`
**Correto:** `.in('conversations.status', ['closed', 'resolved', 'finished'])`
Impacto: conversas `resolved`/`finished` ficam como lixo na fila.

### 2. `health-check-ai/index.ts` L69
**Atual:** `.in('conversations.status', ['closed'])`
**Correto:** `.in('conversations.status', ['closed', 'resolved', 'finished'])`
Impacto: métrica de stale queue sub-reporta o problema real.

## Plano

2 edições cirúrgicas de 1 linha cada. Nenhuma refatoração. Após aplicar, todos os 5 fixes estarão 100%.

