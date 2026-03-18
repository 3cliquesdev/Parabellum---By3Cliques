

# Auditoria: Resíduos de Lógica Antiga no Fluxo Financeiro OTP

## Problemas Encontrados

### 1. Bloco OTP automático (linhas 6300-6421) — Ainda usa `isWithdrawalRequest` em vez de `isFinancialActionRequest`

**Linha 6309**: A condição do bloco que envia OTP automaticamente ainda filtra **apenas saque**:
```typescript
if (contactHasEmail && isWithdrawalRequest && !hasRecentOTPVerification && !flow_context)
```
**Deveria ser**: `isFinancialActionRequest` para cobrir reembolso/estorno também.

Além disso:
- **Linha 6301-6307**: Comentários dizem "OTP APENAS PARA SAQUE" e "Reembolso → Sem OTP"
- **Linha 6348**: `otp_reason: 'withdrawal'` hardcoded — deveria ser `'financial_action'` ou dinâmico
- **Linha 6356**: Mensagem diz "Verificação de Segurança **para Saque**" e "Para saques da carteira" — deveria ser genérica

### 2. Comentários antigos na detecção (linhas 5831-5835)

```
// 1. SAQUE DE SALDO → Exige OTP (segurança máxima)
// 2. REEMBOLSO DE PEDIDO → Sem OTP (explica processo)
```
Contradiz a nova lógica onde reembolso **também exige OTP**.

### 3. Comentário antigo no `isRefundRequest` (linha 5848)

```
// 📦 REEMBOLSO DE PEDIDO - Sem OTP, explica processo
```
Desatualizado — reembolso agora exige OTP.

### 4. Fallback (linhas 7399-7404) — Lógica duplicada/confusa

```typescript
} else if (isFinancialActionRequest) {
  assistantMessage = '...preciso confirmar sua identidade. Qual é o seu e-mail de compra?';
} else if (isFinancialRequest && !isInformationalQuestion) {
  assistantMessage = '...Qual é o seu e-mail de compra?';
```
A segunda condição (`isFinancialRequest && !isInformationalQuestion`) pega ações financeiras que já deveriam ter sido capturadas pela primeira condição. Isso pode causar pedido de email em casos que não deveriam.

### 5. Handler de Cancelamento (linhas 6520-6533) — Diz "NÃO PEÇA OTP"

```typescript
if (isCancellationRequest && !isWithdrawalRequest) {
  identityWallNote += `**NÃO PEÇA OTP** para esta situação.`;
}
```
Correto mas o guard `!isWithdrawalRequest` deveria ser `!isFinancialActionRequest` para evitar conflito se mensagem matchear ambos os padrões.

---

## Correções Planejadas

### A. Bloco OTP automático (linhas 6300-6421)
- Mudar condição de `isWithdrawalRequest` para `isFinancialActionRequest`
- Atualizar comentários de "APENAS SAQUE" para "AÇÕES FINANCEIRAS"
- Mudar `otp_reason: 'withdrawal'` para `otp_reason: isWithdrawalRequest ? 'withdrawal' : 'financial_action'`
- Mudar mensagem de "Verificação para Saque" para "Verificação de Segurança" genérica

### B. Comentários desatualizados (linhas 5831-5835, 5848)
- Atualizar para refletir nova regra: saque E reembolso exigem OTP

### C. Fallback (linhas 7399-7404)
- Remover a condição duplicada `isFinancialRequest && !isInformationalQuestion` que pede email
- Manter apenas `isFinancialActionRequest` → pedir email e `isFinancialRequest` (informativa) → responder direto

### D. Handler de Cancelamento (linha 6521)
- Mudar guard de `!isWithdrawalRequest` para `!isFinancialActionRequest`

### E. Deploy
- Redeploiar `ai-autopilot-chat`

