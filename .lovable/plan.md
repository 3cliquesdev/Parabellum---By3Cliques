

# Fix: LLM Vazia Pós-OTP + Menu de Escape Sem Opções + Mensagem OTP Genérica

## 3 Bugs Identificados

### Bug 1 — Trava Financeira bloqueia MESMO após OTP verificado (CRÍTICO)
**Linha 1644** do `ai-autopilot-chat/index.ts` — a interceptação de entrada ("TRAVA FINANCEIRA") verifica `flow_context?.otpVerified` mas **ignora** `hasRecentOTPVerification`:

```
if (ragConfig.blockFinancial && flowForbidFinancial && !otpAlreadyVerified && ...)
```

Quando o OTP é validado pelo caminho transversal (dentro do autopilot), `flow_context.otpVerified` continua `false`. Resultado: o usuário diz "quero sacar" → bloco dispara → retorna `financialBlocked: true` sem mensagem → webhook re-invoca `process-chat-flow` com `forceFinancialExit` → rota para nó de escape → "Não consegui resolver por aqui" sem opções.

**Fix**: Adicionar `&& !hasRecentOTPVerification` ao guard da linha 1644:
```typescript
const otpAlreadyVerified = !!(flow_context?.otpVerified) || hasRecentOTPVerification;
```

### Bug 2 — Mensagem OTP genérica ignora contexto do cliente
**Linha 6309-6314** — Após validar OTP, a mensagem diz:
> "Agora posso te ajudar com questões financeiras. **Como posso te ajudar?**"

O cliente JÁ disse "quero sacar o valor da minha conta" — perguntar de novo é percebido como burrice da IA.

**Fix**: Mudar a mensagem de sucesso para reconhecer a solicitação original e iniciar a coleta:
```typescript
const directOTPSuccessResponse = otpData?.success 
  ? `**Código validado com sucesso!**\n\nOlá ${contactName}! Sua identidade foi confirmada.\n\nVou prosseguir com sua solicitação financeira. Para isso, preciso de alguns dados.\n\nQual é a sua **chave PIX** para recebimento?`
  : ...;
```

### Bug 3 — Instrução "CLIENTE RECÉM-VERIFICADO" manda IA perguntar "Como posso te ajudar?"
**Linha 6671** — Quando `isRecentlyVerified = true`, a instrução no prompt diz:
> "Seja acolhedor e pergunte 'Como posso te ajudar?'"

Isso contradiz o `otpVerifiedInstruction` que manda coletar PIX. E mesmo que o Bug 1 não existisse, a IA recebe instrução conflitante.

**Fix**: Condicionar essa instrução para NÃO disparar quando `isFinancialActionRequest && hasRecentOTPVerification`:
```typescript
${isRecentlyVerified && !(isFinancialActionRequest && hasRecentOTPVerification) ? '...' : ''}
```

## Resumo das Alterações

| Bug | Arquivo | Linha | Alteração |
|-----|---------|-------|-----------|
| 1 | `ai-autopilot-chat/index.ts` | ~1643 | `otpAlreadyVerified` inclui `hasRecentOTPVerification` |
| 2 | `ai-autopilot-chat/index.ts` | ~6309-6314 | Mensagem OTP sucesso inicia coleta PIX em vez de "Como posso te ajudar?" |
| 3 | `ai-autopilot-chat/index.ts` | ~6671 | Instrução "recém-verificado" não contradiz coleta financeira |

## Fluxo Esperado Após Fix

```text
Cliente: "quero sacar o valor da minha conta"
→ OTP enviado (barreira financeira)
Cliente: "359019"
→ "Código validado! Vou prosseguir com sua solicitação. Qual é sua chave PIX?"
Cliente: "minha chave é fulano@email.com"
→ IA coleta banco, motivo, valor (otpVerifiedInstruction ativo)
→ IA cria ticket com create_ticket
```

Zero risco de regressão — apenas adiciona fallback ao check existente e corrige mensagens contraditórias.

