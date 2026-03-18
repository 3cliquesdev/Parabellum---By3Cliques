

# Auditoria V16.1 — Conflito Remanescente no `process-chat-flow`

## Bug 36 (CRITICO): `financialIntentMatch` no process-chat-flow NÃO respeita OTP verificado

**Localização:** `supabase/functions/process-chat-flow/index.ts` L3336-3338

**O que acontece:**

Quando o cliente está no `node_ia_financeiro` com OTP já verificado e diz "quero sacar meu dinheiro":

1. L3336: `financialIntentMatch = (forbidFinancial && isFinancialAction && !isFinancialInfo)` → **TRUE**
2. L3450: `if (financialIntentMatch && !collectedData.__ai_otp_verified)` — **apenas log**, não suprime o match
3. L3662: `if (financialIntentMatch || ...)` → **EXIT do nó AI**
4. L3706: `path = 'financeiro'`
5. O fluxo avança para o próximo nó via edge — **ai-autopilot-chat NUNCA é chamado**

**Resultado:** Mesmo com os fixes V16.1 no `ai-autopilot-chat` (bypass da trava financeira + prompt de coleta), o `process-chat-flow` ejeta o cliente do nó AI **antes** da mensagem chegar ao autopilot. O cliente é roteado para o escape/saque node em vez de permanecer para coleta de dados.

**Fix:** Na L3336, adicionar `!collectedData.__ai_otp_verified` à condição:

```typescript
financialIntentMatch =
  !collectedData.__ai_otp_verified &&
  ((forceFinancialExit && forbidFinancial) ||
   (forbidFinancial && msgLower.length > 0 && isFinancialAction && !isFinancialInfo));
```

Quando OTP já verificado, a mensagem financeira deve permanecer no nó AI para coleta de dados (stayOnNode=true), e o `ai-autopilot-chat` cuida da coleta via `otpVerifiedInstruction`.

---

## Verificação Positiva — Sem Outros Conflitos

| Ponto verificado | Status |
|---|---|
| `otpVerified` propagado no webhook Meta (greeting + direct + batching) | ✅ OK |
| `otpVerified` propagado no `handle-whatsapp-event` | ✅ OK |
| `otpVerified` propagado no `process-buffered-messages` | ✅ OK |
| Bug 33 fix: trava financeira entrada bypassed pós-OTP | ✅ OK |
| Bug 34 fix: `financialGuardInstruction` desativado pós-OTP | ✅ OK |
| `otpVerifiedInstruction` injetado no prompt assembly | ✅ OK |
| `create_ticket` hard guard bypass pós-OTP (L8312) | ✅ OK |
| Anti-alucinação OTP no `generateRestrictedPrompt` | ✅ OK |
| `pendingFallbackMsg` acumulado e injetado em `extraMessages` | ✅ OK |
| `cancellationIntentMatch` — não afetado pelo OTP (correto) | ✅ OK |
| `saqueIntentMatch` — só via intentData, não regex (sem conflito) | ✅ OK |

---

## Plano de Correção

### 1 arquivo, 1 edição cirúrgica

**`supabase/functions/process-chat-flow/index.ts` L3336-3338:**

Suprimir `financialIntentMatch` quando `__ai_otp_verified === true` no `collectedData`. Isso mantém o cliente no nó AI para coleta de dados pós-OTP.

