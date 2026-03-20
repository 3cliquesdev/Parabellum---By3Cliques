
# Fix: OTP Verificado via Flow Context não reconhecido pelo Autopilot

## Diagnóstico — Conversa #C4AFDD4D

**Timeline:**
1. Cliente já tinha OTP verificado (`__ai_otp_verified: true` no collected_data)
2. Cliente disse "Quero sacar dinheiro" no nó financeiro
3. IA enviou resposta genérica "✅ Identidade verificada com sucesso..." em vez do template de coleta PIX
4. Cliente respondeu "Ok" → transfer intent detectada → conversa perdida

**Causa raiz:** `hasRecentOTPVerification` (L6109) depende de query na tabela `email_verifications` filtrada por `contactEmail`. Este cliente NÃO tem email cadastrado (`customer_email_found: ""`), então a query retorna vazio e `hasRecentOTPVerification = false`, MESMO que `flow_context.otpVerified = true`.

Isso causa cascata de falhas:
- Post-OTP guard (L6328) → skipped
- identityWallNote com template → never set
- Fallback blocker (L9936) → skipped
- LLM gera resposta genérica → fallback_phrase_detected → flowExit

## Correção

### `supabase/functions/ai-autopilot-chat/index.ts`

**Local único — L6109:**
Unificar as duas fontes de verdade de OTP: a query no banco (`recentVerification`) E o estado do fluxo (`flow_context.otpVerified`).

```
Antes:
const hasRecentOTPVerification = !!recentVerification;

Depois:
const hasRecentOTPVerification = !!recentVerification || flow_context?.otpVerified === true;
```

Isso resolve TODOS os pontos downstream de uma vez:
- Post-OTP guard (L6328) → ativado ✅
- `_otpJustValidated` → setado ✅
- identityWallNote com description_template → enviado ✅
- Fallback blocker (L9936) → funciona como safety net ✅
- Financial barrier (L6234) → `!hasRecentOTPVerification` = false → correto ✅

### Deploy
- `ai-autopilot-chat`

## Impacto
Uma única linha corrige o bug para TODOS os clientes que foram verificados por OTP mas não têm email no campo `contactEmail` (ex: verificados por telefone, ou email em `verified_email` no metadata mas não no contato).
