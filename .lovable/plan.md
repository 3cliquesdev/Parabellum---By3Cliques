

# Auditoria: Saída de Cancelamento — Bugs Encontrados

## Resultado da Auditoria

### ✅ CORRETO — `process-chat-flow`
| Ponto | Status |
|---|---|
| `cancellationActionPattern` com regex completa (L3142) | ✅ |
| `cancellationAmbiguousPattern` para termos isolados (L3144) | ✅ |
| `forbidCancellation` lido do nó (L3094) | ✅ |
| `cancellationIntentMatch` depende de `forbidCancellation` (L3152) | ✅ |
| Desambiguação logada quando ambíguo + forbidCancellation (L3148) | ✅ |
| Path selection → `cancelamento` (L3468-3470) | ✅ |
| `intentData.ai_exit_intent='cancelamento'` → `cancellationIntentMatch=true` (L3382) | ✅ |
| Auto-detect → `collectedData.ai_exit_intent='cancelamento'` (L3394-3396) | ✅ |

### 🔴 BUG CRÍTICO 1: Trava de cancelamento usa `flowForbidFinancial` em vez de `forbidCancellation`

**Arquivo:** `ai-autopilot-chat/index.ts`, linha 1614

```typescript
if (flowForbidFinancial && customerMessage && ... && isCancellationAction && !isFinancialInfo) {
```

Deveria ser:
```typescript
if (forbidCancellation && customerMessage && ... && isCancellationAction && !isFinancialInfo) {
```

**Impacto:** A interceptação de cancelamento na entrada do autopilot **só funciona se `forbidFinancial` estiver ativo**. Se o nó AI tem `forbid_cancellation=true` mas `forbid_financial=false`, a trava de cancelamento **NÃO dispara** e a IA responde normalmente em vez de devolver ao fluxo.

### 🔴 BUG CRÍTICO 2: Prompt de cancelamento retorna `[[FLOW_EXIT]]` em vez de `[[FLOW_EXIT:cancelamento]]`

**Arquivo:** `ai-autopilot-chat/index.ts`, linhas 1282-1284 e 1286-1289

O prompt instrui a IA a retornar `[[FLOW_EXIT]]` (sem intent), mas o sistema precisa de `[[FLOW_EXIT:cancelamento]]` para que o `intentData.ai_exit_intent` seja propagado e o `process-chat-flow` roteia para o path `cancelamento`.

Com `[[FLOW_EXIT]]` genérico, o parser extrai `aiExitIntent = undefined`, e o path de saída cai em `default` em vez de `cancelamento`.

### 🔴 BUG CRÍTICO 3: Webhooks NÃO tratam `cancellationBlocked`

**Arquivo:** `meta-whatsapp-webhook/index.ts` e `handle-whatsapp-event/index.ts`

Quando o autopilot retorna `{ cancellationBlocked: true, hasFlowContext: true }`:
- `meta-whatsapp-webhook` só verifica `autopilotData?.financialBlocked` (L1238) → **ignora cancellation**
- `handle-whatsapp-event` verifica `cancellationBlocked` no `needsFlowAdvance` (L1353) → **MAS** no exitType mapping (L1358-1359), cancellation cai em `forceAIExit` genérico em vez de um exit type dedicado

**Impacto:** Cancelamento bloqueado com flow context não re-invoca `process-chat-flow` corretamente no `meta-whatsapp-webhook`. No `handle-whatsapp-event`, re-invoca com `forceAIExit` genérico sem `intentData`, causando fallback para path `default`.

### 🟡 BUG 4: Sem desambiguação de cancelamento no prompt do autopilot

Diferente do financeiro (que tem `ambiguousFinancialDetected` + instrução de desambiguação injetada no prompt L6338-6344), o cancelamento **não tem** equivalente. A desambiguação de cancelamento está apenas no `generateRestrictedPrompt` (L1286-1289), mas sem a mesma estrutura de `[[FLOW_EXIT:cancelamento]]` na confirmação.

## Plano de Correções

### Fix 1 — Corrigir guard do cancelamento no autopilot (L1614)
Criar variável `flowForbidCancellation` e usá-la no guard:
```typescript
const flowForbidCancellation: boolean = flow_context?.forbidCancellation ?? false;
// ...
if (flowForbidCancellation && customerMessage && ... && isCancellationAction && !isFinancialInfo) {
```

### Fix 2 — Atualizar prompt para usar `[[FLOW_EXIT:cancelamento]]`
Na trava de cancelamento (L1282-1284):
```
E retorne [[FLOW_EXIT:cancelamento]] imediatamente.
```
Na desambiguação (L1286-1289), adicionar:
```
Se o cliente confirmar que quer CANCELAR → responda com [[FLOW_EXIT:cancelamento]]
```

### Fix 3 — `meta-whatsapp-webhook`: Tratar `cancellationBlocked`
Após o bloco `if (autopilotData?.financialBlocked)` (L1238), adicionar bloco equivalente:
```typescript
else if (autopilotData?.cancellationBlocked) {
  // Re-invocar process-chat-flow com intentData: { ai_exit_intent: 'cancelamento' }
}
```

### Fix 4 — `handle-whatsapp-event`: Mapear `cancellationBlocked` corretamente
No exitType mapping (L1358-1359), adicionar:
```typescript
const exitType = aiResponse.financialBlocked ? 'forceFinancialExit' : 
                 aiResponse.commercialBlocked ? 'forceCommercialExit' :
                 aiResponse.cancellationBlocked ? 'forceCancellationExit' : 'forceAIExit';
```
E na propagação do body (L1367-1370):
```typescript
...(aiResponse.cancellationBlocked ? { intentData: { ai_exit_intent: 'cancelamento' } } : {}),
```

### Fix 5 — Adicionar `ambiguousCancellationDetected` no prompt da LLM
Paridade com financeiro — injetar instrução de desambiguação de cancelamento quando termo isolado detectado, com `[[FLOW_EXIT:cancelamento]]` na confirmação.

## Arquivos Modificados

| Arquivo | Mudanças |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Fix guard L1614, prompt `[[FLOW_EXIT:cancelamento]]`, desambiguação |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Tratar `cancellationBlocked` na re-invocação |
| `supabase/functions/handle-whatsapp-event/index.ts` | Mapear `cancellationBlocked` → `intentData` |

