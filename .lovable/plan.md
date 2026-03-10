
# Ajustar tag e mensagem de inatividade no auto-close ✅

## Status: IMPLEMENTADO

## Resumo

Encerramento por inatividade agora usa tag **9.98 Falta de Interação** e mensagem dinâmica com horário de atendimento.

## Alterações

| Local | Mudança |
|-------|---------|
| `auto-close-conversations/index.ts` | Import `getBusinessHoursInfo`, constante `FALTA_INTERACAO_TAG_ID`, mensagem dinâmica `buildInactivityCloseMessage()` |
| Etapa 2 (dept inatividade) | Tag 9.04 → 9.98, mensagem com horário |
| Etapa 3 (AI inatividade) | Tag 9.04 → 9.98, mensagem unificada com horário |
| Etapa 3b (sem dept) | Tag 9.04 → 9.98, mensagem unificada com horário |
| Etapa 1 (WhatsApp expired) | Mantém tag 9.04 (cenário diferente: janela expirada) |

## Garantias

- `DESISTENCIA_TAG_ID` mantido no código para uso futuro
- Horário buscado uma vez no início via `getBusinessHoursInfo`
- Fallback em `buildScheduleSummary` se sem config: "Sem horário configurado"
