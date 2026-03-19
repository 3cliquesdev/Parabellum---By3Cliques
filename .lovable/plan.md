

# Fix: IA Perde Contexto de Coleta Financeira Após OTP

## Problema

Na conversa #598D4093, após OTP validado:
1. IA pede "Qual sua chave PIX?" 
2. Cliente responde "02461362270" (CPF/PIX)
3. IA ignora e diz "Pode me contar com mais detalhes?" — perdeu totalmente o contexto de coleta

**Causa raiz**: A instrução de coleta (`otpVerifiedInstruction`, linha 6751) só ativa quando `isFinancialActionRequest` é `true`. Mas "02461362270" não bate com nenhum regex financeiro, então a instrução desaparece. A IA fica sem saber o que fazer.

## Correções

### Fix 1 — `otpVerifiedInstruction` deve ativar SEMPRE que OTP foi verificado recentemente
**Linha 6751** — Adicionar `hasRecentOTPVerification` como condição independente (sem depender de `isFinancialActionRequest`):

```typescript
// ANTES:
const otpVerifiedInstruction = (flow_context?.otpVerified || (hasRecentOTPVerification && isFinancialActionRequest)) ? ...

// DEPOIS:
const otpVerifiedInstruction = (flow_context?.otpVerified || hasRecentOTPVerification) ? ...
```

Isso garante que enquanto o OTP for recente (1h), a IA mantém a instrução de coleta de dados ativa em TODAS as mensagens subsequentes.

### Fix 2 — Mensagem OTP sucesso deve listar TODOS os dados necessários
**Linha 6311-6318** — A mensagem pós-OTP deve informar claramente o que será coletado:

```
**Código validado com sucesso!** ✅

Olá {nome}! Sua identidade foi confirmada.

Para dar andamento à sua solicitação financeira, vou precisar das seguintes informações:

1. **Chave PIX** para recebimento
2. **Banco** da conta
3. **Valor** solicitado
4. **Motivo** da solicitação

Vamos começar: qual é a sua **chave PIX**?
```

### Fix 3 — Suprimir "Como posso te ajudar?" quando em coleta pós-OTP
**Linha 6675** — A condição já foi parcialmente corrigida, mas `isFinancialAction` pode não estar definida. Usar `hasRecentOTPVerification` diretamente:

```typescript
// ANTES:
${isRecentlyVerified && !(isFinancialAction && hasRecentOTPVerification) ? ...

// DEPOIS:
${isRecentlyVerified && !hasRecentOTPVerification ? ...
```

## Fluxo Esperado Após Fix

```text
Cliente: "quero sacar"
→ OTP enviado
Cliente: "359019"
→ "Código validado! Vou precisar de: 1) Chave PIX, 2) Banco, 3) Valor, 4) Motivo. Qual sua chave PIX?"
Cliente: "02461362270"
→ IA reconhece como PIX (otpVerifiedInstruction ATIVO) → "Obrigado! Qual o banco?"
Cliente: "Bradesco"
→ "Qual o valor do saque?"
... coleta completa → ticket criado
```

## Arquivos Alterados

| Linha | Alteração |
|-------|-----------|
| 6311-6318 | Mensagem OTP sucesso lista todos os campos |
| 6751 | `otpVerifiedInstruction` ativa com `hasRecentOTPVerification` (sem exigir `isFinancialActionRequest`) |
| 6675 | Saudação genérica suprimida quando `hasRecentOTPVerification` |

