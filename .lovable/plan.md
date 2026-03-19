

# Auditoria Final: Coleta Dinâmica — 2 Falhas Restantes

## Status Geral

A propagação no `process-chat-flow` (7 pontos) e no `meta-whatsapp-webhook` (2 pontos) está **100% OK**. Porém encontrei **2 funções adicionais** que constroem `flow_context` manualmente e **NÃO propagam** `smartCollectionEnabled` / `smartCollectionFields`.

## Falhas Encontradas

### FALHA 1: `handle-whatsapp-event/index.ts` (L1329-1354)

Constrói `flowContext` manualmente com todos os campos (`forbid*`, `ticketConfig`, `otpVerified`, etc.) mas **falta**:
```typescript
smartCollectionEnabled: flowResult.smartCollectionEnabled ?? false,
smartCollectionFields: flowResult.smartCollectionFields || [],
```

**Impacto**: Conversas pelo Evolution API (WhatsApp não-Meta) perdem a configuração de coleta.

### FALHA 2: `process-buffered-messages/index.ts` (L380-405)

No bloco `else if (flowData)` que constrói `flow_context` a partir de `flowData`, **falta**:
```typescript
smartCollectionEnabled: flowData.smartCollectionEnabled ?? false,
smartCollectionFields: flowData.smartCollectionFields || [],
```

**Impacto**: Mensagens bufferizadas (batched) perdem a configuração quando o `flow_context` não veio pré-construído.

## Correção

Adicionar 2 linhas em cada arquivo, nos blocos identificados acima.

## Após Correção

Sistema estará 100% coberto em todos os caminhos:
- `process-chat-flow` → 7/7 ✅
- `meta-whatsapp-webhook` → 2/2 ✅
- `handle-whatsapp-event` → 0/1 ❌ → corrigir
- `process-buffered-messages` → 0/1 ❌ → corrigir
- `ai-autopilot-chat` (consumidor) → ✅ OK, usa fallback se undefined

Deploy de `handle-whatsapp-event` e `process-buffered-messages` após edição.

