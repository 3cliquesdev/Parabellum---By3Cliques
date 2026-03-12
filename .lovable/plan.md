

# Auditoria Completa: Todas as Saídas de Intenção — Comercial, Consultor, Suporte, Financeiro, Cancelamento

## Resultado: 5 Bugs Encontrados

### ✅ CORRETO (resumo)

| Cadeia | Pontos verificados | Status |
|---|---|---|
| Financeiro (ação + desambiguação + webhooks + process-chat-flow) | 12 pontos | ✅ |
| Cancelamento (ação + desambiguação + webhooks + process-chat-flow) | 12 pontos | ✅ |
| Prompts `generateRestrictedPrompt` com `[[FLOW_EXIT:intent]]` para TODOS os 5 intents | 5 pontos | ✅ |
| `ESCAPE_PATTERNS` / `isCleanExit` reconhece `[[FLOW_EXIT:intent]]` | 2 pontos | ✅ |
| `process-chat-flow` path selection (6 paths: financeiro/cancelamento/comercial/suporte/consultor/default) | 6 pontos | ✅ |
| `process-chat-flow` `intentData.ai_exit_intent` mapping para todos os 5 intents | 5 pontos | ✅ |
| `process-chat-flow` auto-detect `ai_exit_intent` para todos os 5 intents | 5 pontos | ✅ |

---

### 🔴 BUG 1: `meta-whatsapp-webhook` NÃO propaga `intentData` para comercial

**Arquivo:** `meta-whatsapp-webhook/index.ts`, L1459-1463 e L1522-1526

Quando `commercialBlocked + hasFlowContext`, o webhook re-invoca `process-chat-flow` com:
```typescript
body: {
  conversationId: conversation.id,
  userMessage: messageContent,
  forceCommercialExit: true,
  // ❌ FALTA: intentData: { ai_exit_intent: 'comercial' }
}
```

Comparar com cancellation (L1632-1637) que inclui `intentData`. Sem isso, o fallback mapping em `process-chat-flow` L3384-3392 não é acionado para comercial quando `forbidCommercial=false` no nó destino (edge case).

**Fix:** Adicionar `intentData: { ai_exit_intent: 'comercial' }` em ambas as chamadas (tentativa 1 e retry).

---

### 🔴 BUG 2: `handle-whatsapp-event` NÃO propaga `intentData` para comercial

**Arquivo:** `handle-whatsapp-event/index.ts`, L1370

```typescript
...(aiResponse.commercialBlocked ? { forceCommercialExit: true } : {}),
// ❌ FALTA: intentData para comercial
```

Cancellation (L1371) inclui `intentData`, mas comercial não.

**Fix:** Adicionar:
```typescript
...(aiResponse.commercialBlocked ? { forceCommercialExit: true, intentData: { ai_exit_intent: 'comercial' } } : {}),
```

---

### 🔴 BUG 3: `handle-whatsapp-event` flow_context NÃO inclui `forbidCancellation` nem `forbidConsultant`

**Arquivo:** `handle-whatsapp-event/index.ts`, L1264-1281

O flow_context passado ao `ai-autopilot-chat` inclui `forbidFinancial` e `forbidCommercial`, mas **NÃO** inclui:
- `forbidCancellation` ❌
- `forbidConsultant` ❌

**Impacto:** No Evolution API, a IA nunca recebe `forbidCancellation=true` nem `forbidConsultant=true`, então as travas de cancelamento e consultor **nunca disparam**. Apenas a Meta webhook tem `forbidCancellation`.

**Fix:** Adicionar ambos ao flow_context (L1280):
```typescript
forbidCancellation: flowResult.forbidCancellation ?? false,
forbidConsultant: flowResult.forbidConsultant ?? false,
```

---

### 🔴 BUG 4: `meta-whatsapp-webhook` buffer context NÃO inclui `forbidCancellation` nem `forbidConsultant`

**Arquivo:** `meta-whatsapp-webhook/index.ts`, L1177-1181

O buffer (batching) context inclui `forbidFinancial` e `forbidCommercial`, mas **NÃO** inclui:
- `forbidCancellation` ❌
- `forbidConsultant` ❌

**Impacto:** Quando mensagens são batchadas, a IA não recebe as flags de cancelamento/consultor.

**Fix:** Adicionar à L1181:
```typescript
forbidCancellation: (flowData as any).forbidCancellation,
forbidConsultant: (flowData as any).forbidConsultant,
```

---

### 🟡 BUG 5: `meta-whatsapp-webhook` direct context NÃO inclui `forbidConsultant`

**Arquivo:** `meta-whatsapp-webhook/index.ts`, L1211-1228

O flow_context direto inclui `forbidFinancial`, `forbidCommercial`, `forbidCancellation`, mas **NÃO** inclui:
- `forbidConsultant` ❌

**Fix:** Adicionar na L1228:
```typescript
forbidConsultant: (flowData as any).forbidConsultant ?? false,
```

---

### 🟡 BUG 6 (cosmético): `ai-autopilot-chat` NÃO tem guard de entrada para comercial com desambiguação e consultor

O comercial tem um guard de entrada (L1682-1741) que bloqueia ANTES da LLM, mas **NÃO tem lógica de desambiguação** como financeiro e cancelamento (ex: `ambiguousCommercialDetected`). Da mesma forma, não existe guard de entrada para consultor.

Porém, isso é parcialmente coberto pelo prompt `generateRestrictedPrompt` e pelo `contextualizedSystemPrompt`. **Não é crítico** — a LLM já recebe instruções para desambiguar via prompt. Porém, a injeção contextualizada (como `financialGuardInstruction` e `cancellationGuardInstruction` em L6346-6377) **NÃO existe** para comercial e consultor.

**Impacto:** Para comercial e consultor, a desambiguação depende apenas do `generateRestrictedPrompt`, que é o system prompt base. Financeiro e cancelamento têm DUAS camadas: `generateRestrictedPrompt` + `guardInstruction` contextualizado. Isso torna comercial/consultor menos robustos em cenários de desambiguação.

**Recomendação:** Adicionar `commercialGuardInstruction` e `consultorGuardInstruction` com paridade ao financeiro/cancelamento, mas como melhoria futura (não é bug de roteamento).

---

## Plano de Correções (4 bugs críticos)

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `meta-whatsapp-webhook/index.ts` L1459-1463 e L1522-1526 | Adicionar `intentData: { ai_exit_intent: 'comercial' }` nas re-invocações comerciais |
| 2 | `handle-whatsapp-event/index.ts` L1370 | Adicionar `intentData: { ai_exit_intent: 'comercial' }` junto com `forceCommercialExit` |
| 3 | `handle-whatsapp-event/index.ts` L1280 | Adicionar `forbidCancellation` e `forbidConsultant` ao flow_context |
| 4 | `meta-whatsapp-webhook/index.ts` L1177-1181 | Adicionar `forbidCancellation` e `forbidConsultant` ao buffer context |
| 5 | `meta-whatsapp-webhook/index.ts` L1228 | Adicionar `forbidConsultant` ao direct context |

5 edições cirúrgicas em 2 arquivos. Sem risco de regressão.

