

# Diagnóstico: "Sacar" Ignorado pela IA

## Causa Raiz Encontrada

Analisando os logs e o banco de dados da conversa `2d7eace8`, identifiquei **2 problemas encadeados**:

### Problema 1: OTP residual bloqueia fluxo

A conversa tem metadata residual de uma tentativa anterior:
```
awaiting_otp: true
otp_reason: withdrawal
ai_mode: waiting_human
```

Quando o test mode é ativado via `TestModeDropdown`, ele seta `ai_mode='autopilot'` — OK. Mas **NÃO limpa a metadata residual** (`awaiting_otp`, `otp_reason`, `claimant_email`, `otp_expires_at`). Isso contamina execuções futuras.

### Problema 2: "sacar" como palavra isolada dispara OTP dentro de fluxo ativo

`OTP_REQUIRED_KEYWORDS` (L788) inclui `'saque'` e `'sacar'` como strings simples. Quando o cliente envia apenas "sacar":
1. `isWithdrawalRequest = true` (match em OTP_REQUIRED_KEYWORDS)
2. O nó `ia_entrada` tem `forbidFinancial: false`
3. O guard `if (flow_context?.forbidFinancial)` na L6030 é FALSO → não protege
4. O bloco OTP na L6075 executa (`!flow_context?.forbidFinancial` é TRUE)
5. OTP é enviado, early return → IA nunca responde pelo fluxo

**Resultado**: A IA entra no caminho de OTP de saque ao invés de tratar "sacar" como termo ambíguo que deveria ser desambiguado pela IA do nó.

### Problema 2b: Webhook Meta sem log visível

Os logs do `meta-whatsapp-webhook` mostram `skipAutoResponse` com `reason: ai_mode_waiting_human` para mensagens recentes — confirmando que APÓS o OTP ter setado `waiting_human` em alguma execução anterior, todas as mensagens seguintes são bloqueadas.

---

## Plano de Correção (3 mudanças)

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `ai-autopilot-chat/index.ts` (~L6027) | Adicionar guard: **se existe `flow_context` (qualquer), PULAR o bloco OTP inteiro**. O fluxo é soberano e tem seu próprio ramo financeiro com OTP nativo. |
| 2 | `TestModeDropdown.tsx` (handleSelectFlow) | Limpar metadata residual ao ativar test mode: remover `awaiting_otp`, `otp_reason`, `otp_expires_at`, `claimant_email` |
| 3 | `ai-autopilot-chat/index.ts` (OTP_REQUIRED_KEYWORDS L787-802) | Remover palavras isoladas `'saque'` e `'sacar'` — manter apenas frases compostas que já estão em `WITHDRAWAL_ACTION_PATTERNS`. Palavras isoladas devem ser tratadas como ambíguas pela desambiguação financeira existente. |

### Detalhes técnicos

**Fix 1** — Guard no bloco OTP:
```typescript
// L6027: Adicionar && !flow_context ao guard
if (contactHasEmail && isWithdrawalRequest && !hasRecentOTPVerification && !flow_context) {
```
Quando há `flow_context`, o fluxo visual é soberano. O ramo financeiro do fluxo tem seu próprio nó de OTP.

**Fix 2** — Limpeza de metadata no TestModeDropdown:
No `handleSelectFlow`, após o update de `is_test_mode` e `ai_mode`, adicionar limpeza de `customer_metadata` residual (remover chaves de OTP).

**Fix 3** — OTP_REQUIRED_KEYWORDS:
Remover `'saque'` e `'sacar'` da lista. Manter apenas `'retirar saldo'`, `'transferir saldo'`, `'saque pix'`, etc. (frases compostas). A detecção de saque já é coberta por `WITHDRAWAL_ACTION_PATTERNS` que exige contexto composto.

Essas 3 correções eliminam o problema de "sacar" ser ignorado tanto em test mode quanto em fluxo manual.

