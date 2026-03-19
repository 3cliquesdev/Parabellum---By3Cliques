

# Diagnóstico: LLM retorna resposta vazia após OTP validado

## Causa Raiz Encontrada

Existem **duas fontes de verdade** para "OTP verificado" que **não se comunicam**:

| Fonte | Onde é setada | Quem usa |
|-------|--------------|----------|
| `hasRecentOTPVerification` | Query na tabela `email_verifications` (DB) | Barreira OTP (linha 6437), fallback vazio (linha 7766) |
| `flow_context.otpVerified` | `collectedData.__ai_otp_verified` no `process-chat-flow` | **`otpVerifiedInstruction`** (linha 6747) — instrução de coleta PIX |

### O que acontece:

1. Cliente pede saque → OTP é enviado (barreira na linha 6437)
2. Cliente digita o código → `verify-code` marca `email_verifications.verified = true`
3. `ai-autopilot-chat` retorna EARLY com "Código validado! Como posso te ajudar?" (linha 6387)
4. **Na próxima mensagem**, o fluxo re-entra:
   - `hasRecentOTPVerification = true` ✅ (query no DB funciona)
   - Barreira OTP na linha 6437 **NÃO dispara** ✅
   - **MAS** `process-chat-flow` nunca soube do OTP transversal → `collectedData.__ai_otp_verified` ainda é `false`
   - `flow_context.otpVerified = false` ❌
   - **`otpVerifiedInstruction` fica VAZIA** ❌ — LLM não recebe instrução de coleta de PIX
   - `financialGuardInstruction` fica ATIVA ❌ (porque `flow_context.otpVerified` é false, linha 6729)
   - LLM recebe instrução contraditória: "bloqueie ações financeiras" + nenhuma instrução de coleta → **resposta vazia ou genérica**

### Resumo: A instrução `otpVerifiedInstruction` depende APENAS de `flow_context.otpVerified`, mas o OTP transversal (feito dentro do `ai-autopilot-chat`) nunca atualiza o `collectedData` do fluxo.

## Solução

### Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`

**2 alterações:**

1. **Linha 6747** — `otpVerifiedInstruction` deve usar OR com `hasRecentOTPVerification`:
```typescript
// Antes:
const otpVerifiedInstruction = flow_context?.otpVerified ? `...` : '';

// Depois:
const otpVerifiedInstruction = (flow_context?.otpVerified || (hasRecentOTPVerification && isFinancialActionRequest)) ? `...` : '';
```

2. **Linha 6729** — `financialGuardInstruction` deve respeitar `hasRecentOTPVerification`:
```typescript
// Antes:
const financialGuardInstruction = (flowForbidFinancial && !flow_context?.otpVerified) ? `...` : '';

// Depois:
const financialGuardInstruction = (flowForbidFinancial && !flow_context?.otpVerified && !hasRecentOTPVerification) ? `...` : '';
```

### Resultado
- Quando OTP é validado pelo caminho transversal (dentro do autopilot), a instrução de coleta PIX é injetada e a trava financeira é desativada
- Quando OTP é validado pelo fluxo visual (process-chat-flow), continua funcionando como antes via `flow_context.otpVerified`
- Zero risco de regressão — apenas adiciona fallback ao check existente

