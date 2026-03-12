

# Auditoria Final: Todas as Saídas de Intenção — Status 100%

## Resultado: 2 Bugs Residuais + 1 Gap de Paridade

### ✅ CORRETO — Todos os pontos verificados

| Cadeia | Verificação | Status |
|---|---|---|
| **Prompts `generateRestrictedPrompt`** com `[[FLOW_EXIT:intent]]` para todos 5 intents | L1284, L1299, L1305, L1314, L1320 | ✅ |
| **`flowForbidCancellation`** guard correto (L1630) | Usa `flowForbidCancellation` | ✅ |
| **`flowForbidCommercial`** guard correto (L1686) | Usa `flowForbidCommercial` | ✅ |
| **Buffer context** inclui todos 4 forbids (L1179-1182) | `forbidFinancial/Commercial/Cancellation/Consultant` | ✅ |
| **Direct context** inclui todos 4 forbids (L1227-1230) | Todos presentes | ✅ |
| **`handle-whatsapp-event` flow_context** inclui todos 4 forbids (L1278-1281) | Todos presentes | ✅ |
| **`handle-whatsapp-event` log** mostra todos 4 forbids (L1288-1291) | ✅ |
| **`handle-whatsapp-event` needsFlowAdvance** checa `cancellationBlocked` (L1359) | ✅ |
| **`handle-whatsapp-event` exitType** mapeia `cancellationBlocked→forceCancellationExit` (L1365) | ✅ |
| **`handle-whatsapp-event` intentData** propaga `comercial` e `cancelamento` (L1374-1375) | ✅ |
| **`meta-whatsapp-webhook` commercialBlocked** re-invoca com `intentData` (L1466, L1530) | ✅ |
| **`meta-whatsapp-webhook` cancellationBlocked** re-invoca com `intentData` (L1632-1637) | ✅ |
| **`process-chat-flow` destructuring** inclui `forceCancellationExit` (L776) | ✅ |
| **`process-chat-flow` forbids** lidos do nó: financial/commercial/cancellation/support/consultant (L3092-3096) | ✅ |
| **`process-chat-flow` intentData mapping** para todos 5 intents (L3384-3392) | ✅ |
| **`process-chat-flow` auto-detect** para todos 5 intents (L3395-3414) | ✅ |
| **`process-chat-flow` path selection** todos 6 paths (L3470-3490) | ✅ |
| **`cancellationGuardInstruction`** no prompt LLM (L6364-6377) | ✅ |
| **`financialGuardInstruction`** no prompt LLM (L6346-6361) | ✅ |
| **Consultor fallback** para suporte quando sem `consultant_id` (L3231-3238) | ✅ |

---

### 🔴 BUG 1: `meta-whatsapp-webhook` financialBlocked NÃO propaga `intentData`

**Arquivo:** `meta-whatsapp-webhook/index.ts`, L1256-1260 e L1322-1326

As re-invocações de `forceFinancialExit` (tentativa 1 e retry) **NÃO incluem** `intentData: { ai_exit_intent: 'financeiro' }`:

```typescript
body: JSON.stringify({
  conversationId: conversation.id,
  userMessage: messageContent,
  forceFinancialExit: true,
  // ❌ FALTA: intentData: { ai_exit_intent: 'financeiro' }
}),
```

Comparar com comercial (L1466) e cancelamento (L1637) que **já incluem** `intentData`. Sem isso, se `forbidFinancial=false` no nó destino, o fallback mapping em `process-chat-flow` L3384-3392 não é acionado para financeiro.

**Fix:** Adicionar `intentData: { ai_exit_intent: 'financeiro' }` em ambas as chamadas (L1259 e L1325).

---

### 🔴 BUG 2: `handle-whatsapp-event` financialBlocked NÃO propaga `intentData`

**Arquivo:** `handle-whatsapp-event/index.ts`, L1373

```typescript
...(aiResponse.financialBlocked ? { forceFinancialExit: true } : {}),
// ❌ FALTA: intentData para financeiro (comercial e cancelamento já têm)
```

**Fix:** Adicionar `intentData: { ai_exit_intent: 'financeiro' }`:
```typescript
...(aiResponse.financialBlocked ? { forceFinancialExit: true, intentData: { ai_exit_intent: 'financeiro' } } : {}),
```

---

### 🟡 GAP DE PARIDADE: Sem `commercialGuardInstruction` nem `consultorGuardInstruction` no prompt da LLM

**Arquivo:** `ai-autopilot-chat/index.ts`, L6379

O `contextualizedSystemPrompt` injeta `financialGuardInstruction` e `cancellationGuardInstruction`, mas **NÃO** injeta equivalente para comercial e consultor. A desambiguação para esses 2 intents depende apenas do `generateRestrictedPrompt` (system prompt base), sem a camada extra contextualizada.

Não é bug de roteamento (o `generateRestrictedPrompt` já tem instruções corretas), mas reduz a robustez da desambiguação em cenários onde o prompt base é diluído por muito contexto.

**Fix:** Adicionar `commercialGuardInstruction` e `consultorGuardInstruction` com paridade ao financeiro/cancelamento, usando `ambiguousCommercialDetected` e `ambiguousConsultorDetected` flags.

---

## Plano de Correções

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `meta-whatsapp-webhook/index.ts` L1259, L1325 | Adicionar `intentData: { ai_exit_intent: 'financeiro' }` nas re-invocações financeiras |
| 2 | `handle-whatsapp-event/index.ts` L1373 | Adicionar `intentData: { ai_exit_intent: 'financeiro' }` junto com `forceFinancialExit` |
| 3 | `ai-autopilot-chat/index.ts` | Adicionar `commercialGuardInstruction` + `consultorGuardInstruction` no `contextualizedSystemPrompt`, com flags `ambiguousCommercialDetected` e `ambiguousConsultorDetected` |

3 correções cirúrgicas em 3 arquivos. Sem risco de regressão.

