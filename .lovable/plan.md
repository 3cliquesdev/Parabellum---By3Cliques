

# Fix: `hasRecentOTPVerification is not defined` — Crash Total do Autopilot

## O que está acontecendo

A conversa #605EEAD9 (Ronildo) morreu porque o autopilot crashou com:

```
ReferenceError: hasRecentOTPVerification is not defined
```

**Causa raiz**: No fix anterior (V16.2), adicionamos `hasRecentOTPVerification` na **linha 1644** (trava financeira pré-LLM), mas essa variável só é **definida na linha 6089** (após query ao banco). O código crashou antes de chegar lá.

## Timeline da conversa

1. Cliente: "bom dia" → Menu de produtos ✅
2. Cliente: "1" (Drop Nacional) → Menu de assuntos ✅
3. Cliente: "2" (Financeiro) → `node_ia_financeiro` ativado → **autopilot crashou** → sem resposta ❌

## Fix

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

**Linha 1644**: Remover `hasRecentOTPVerification` do guard pré-LLM. Neste ponto do código, só temos acesso a `flow_context`. A verificação completa (incluindo DB) já acontece corretamente na linha 6089+.

```typescript
// ANTES (crash):
const otpAlreadyVerified = !!(flow_context?.otpVerified) || hasRecentOTPVerification;

// DEPOIS (safe):
const otpAlreadyVerified = !!(flow_context?.otpVerified);
```

Isso é seguro porque:
- A trava financeira da linha 1644 é um **early exit** para conversas SEM fluxo ativo (redireciona para departamento financeiro)
- Quando há fluxo ativo (`flow_context` presente), a trava NÃO executa o redirect — ela apenas marca `financialBlocked: true`
- A verificação completa com `hasRecentOTPVerification` (DB) já acontece nas linhas 6089-6159, que é onde o OTP barrier real opera

**Resultado**: Zero crash, fluxo financeiro volta a funcionar, OTP barrier continua protegido pela verificação completa mais adiante.

