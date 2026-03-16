

# Auditoria Final: Paridade firstEntry + forbidSupport

## Gaps Encontrados

### Gap 1 — `handle-whatsapp-event/index.ts` (L1338)
`customerMessage: messageText` envia o texto cru (ex: "2") para a IA quando `firstEntry` é true. Falta a substituição contextual.

**Correção:** Substituir L1338 por:
```typescript
customerMessage: (flowResult.firstEntry && flowResult.selectedOption)
  ? `Cliente selecionou: ${flowResult.selectedOption}`
  : messageText,
```

### Gap 2 — `handle-whatsapp-event/index.ts` (L1305-1323)
O `flowContext` não inclui `forbidSupport`, diferente do `meta-whatsapp-webhook`.

**Correção:** Adicionar após L1323:
```typescript
forbidSupport: flowResult.forbidSupport ?? false,
```

### Gap 3 — `process-buffered-messages/index.ts` (L343)
`customerMessage: concatenatedMessage` não verifica `firstEntry` do `flowData`.

**Correção:** Substituir L343 por:
```typescript
customerMessage: (flowData?.firstEntry && flowData?.selectedOption)
  ? `Cliente selecionou: ${flowData.selectedOption}`
  : concatenatedMessage,
```

## Resumo
3 edits pontuais + redeploy das 2 edge functions para paridade 100% entre Meta, Evolution API e Batching.

