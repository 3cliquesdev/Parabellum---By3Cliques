

# Auditoria V16 — Conflitos Lógicos Detectados

## Bug 33 (CRÍTICO): Trava Financeira ENTRADA bloqueia coleta pós-OTP

**Localização:** `ai-autopilot-chat/index.ts` L1639-1723

**Conflito:** Após OTP verificado, quando o cliente diz "quero sacar meu dinheiro", a sequência de execução é:

1. L1569: `flowForbidFinancial = true` (flag do nó financeiro)
2. L1639: `if (flowForbidFinancial && isFinancialAction && !isFinancialInfo)` → **TRUE**
3. L1700: Return imediato com `financialBlocked: true, exitKeywordDetected: true`
4. **A LLM NUNCA É CHAMADA** → a instrução `otpVerifiedInstruction` (L6737) nunca executa

O bloco de interceptação na ENTRADA (L1639) **NÃO verifica** se o OTP já foi validado (`hasRecentOTPVerification`). Ele bloqueia TODA ação financeira quando `forbidFinancial=true`, mesmo que o cliente já tenha passado pelo OTP. Resultado: o `process-chat-flow` recebe `exitKeywordDetected=true` e avança para o escape node em vez de permitir a coleta de dados.

**Fix:** Adicionar bypass na trava financeira de entrada quando `hasRecentOTPVerification === true`:

```typescript
// L1639 — Adicionar && !hasRecentOTPVerification
if (ragConfig.blockFinancial && flowForbidFinancial && !hasRecentOTPVerification && customerMessage && ...)
```

Isso permite que, após OTP verificado, a mensagem financeira chegue à LLM onde o `otpVerifiedInstruction` instrui a coleta de dados.

---

## Bug 34 (MODERADO): `financialGuardInstruction` contradiz `otpVerifiedInstruction`

**Localização:** `ai-autopilot-chat/index.ts` L6834

**Conflito:** No prompt assembly (L6834), ambas as instruções são injetadas simultaneamente:
- `otpVerifiedInstruction`: "NÃO emita [[FLOW_EXIT]]. Permaneça no nó e COLETE dados."
- `financialGuardInstruction`: "Se o cliente pedir ação financeira → [[FLOW_EXIT:financeiro]]"

Se o Bug 33 for corrigido e a mensagem chegar à LLM, a IA recebe instruções **contraditórias**: uma diz para ficar e coletar, outra diz para sair imediatamente.

**Fix:** Desativar `financialGuardInstruction` quando `otpVerified === true`:

```typescript
const financialGuardInstruction = (flowForbidFinancial && !flow_context?.otpVerified) ? `...` : '';
```

---

## Bug 35 (MENOR): `smart_collection_enabled` e `smart_collection_fields` não existem no código

**Localização:** Nenhuma referência encontrada no codebase

**Problema:** O plano V16 mencionou habilitar `smart_collection_enabled: true` e `smart_collection_fields` no flow_definition, mas **nenhum código** no `ai-autopilot-chat` ou `process-chat-flow` lê essas flags. A instrução de coleta depende exclusivamente do `otpVerifiedInstruction` no prompt — o que é uma boa abordagem, mas as flags no DB são inúteis sem código que as consuma.

**Fix:** Não é blocker — a instrução via prompt é suficiente. Remover as flags do DB para evitar confusão, ou implementar leitura futura.

---

## Bug 36 (MODERADO): `create_ticket` hard guard bloqueia tickets financeiros mesmo pós-OTP parcialmente

**Localização:** `ai-autopilot-chat/index.ts` L8309

**Status:** Já tem bypass: `!flow_context?.otpVerified` — ou seja, se `otpVerified=true`, o ticket passa. ✅ OK, sem conflito aqui.

---

## Plano de Correção

### Prioridade 1 — Bug 33: Bypass da trava financeira pós-OTP
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` L1639
- Adicionar `&& !hasRecentOTPVerification` na condição do if

### Prioridade 2 — Bug 34: Desativar guard financeiro no prompt pós-OTP
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` L6719
- Condicionar `financialGuardInstruction` a `!flow_context?.otpVerified`

### Prioridade 3 — Bug 35: Cleanup das flags inúteis (opcional)
- Sem impacto funcional, pode ser feito depois

### Resumo: 1 arquivo, 2 edições cirúrgicas

