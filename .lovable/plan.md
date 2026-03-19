

# Auditoria Completa: Pontos de Falha no Fluxo OTP → Coleta Financeira

## 🔴 Bug Crítico — `__ai_otp_verified` NUNCA é setado pelo Autopilot

**Impacto**: Após OTP validado, a **próxima mensagem** do cliente (ex: "minha chave pix é X") é processada pelo `process-chat-flow`, que verifica `collectedData.__ai_otp_verified` (linha 3383). Como o autopilot **nunca seta** esse campo no `chat_flow_states.collected_data`, o resultado é:

```text
otpVerifiedInFlow = false
→ financialIntentMatch pode disparar novamente
→ conversa é EJETADA do nó AI
→ cliente fica sem resposta ou recebe menu de escape
```

**Cenário real**: Cliente diz "minha chave pix é fulano@email.com" → a palavra "pix" bate no `financialActionPattern` do `process-chat-flow` (regex inclui "pix") → `financialIntentMatch = true` → ejeção.

**Fix**: No autopilot, após OTP validado com sucesso (linha 6331-6352), TAMBÉM atualizar `chat_flow_states.collected_data.__ai_otp_verified = true`:

```typescript
// Após limpar flags na conversations metadata (linha 6352):
if (flow_context?.stateId) {
  const { data: currentState } = await supabaseClient
    .from('chat_flow_states')
    .select('collected_data')
    .eq('id', flow_context.stateId)
    .maybeSingle();
  
  await supabaseClient
    .from('chat_flow_states')
    .update({
      collected_data: {
        ...(currentState?.collected_data || {}),
        __ai_otp_verified: true,
        __ai_otp_step: undefined,
      }
    })
    .eq('id', flow_context.stateId);
}
```

## 🟡 Bug Secundário — Keyword "pix" em `FINANCIAL_BARRIER_KEYWORDS` pode causar re-trigger

**Linha 758**: `FINANCIAL_BARRIER_KEYWORDS` inclui "pix". Quando o cliente diz "minha chave pix é 02461362270", `isFinancialRequest` fica `true`.

Porém, `isFinancialActionRequest` exige `isWithdrawalRequest || isRefundRequest`, então "minha chave pix" NÃO dispara a barreira OTP do autopilot. **Isso está seguro no autopilot.**

No entanto, no `process-chat-flow` (linha 3372-3373), o regex `financialActionPattern` É separado e pode ter "pix" como pattern. Preciso confirmar se o regex do `process-chat-flow` matcharia "minha chave pix é X". Se sim, o Bug Crítico acima é o que protege — com `__ai_otp_verified = true`, `financialIntentMatch` fica suprimido.

## 🟡 Bug Terciário — `flow_context.stateId` pode não estar disponível

Se o autopilot é invocado sem `stateId` no `flow_context`, o fix do Bug Crítico não consegue atualizar o `collected_data`. Preciso verificar se todos os caminhos de invocação propagam `stateId`.

**Ação**: Adicionar guard `if (flow_context?.stateId)` para evitar crash, e logar warning quando `stateId` ausente.

## 🟢 Seguro — `otpVerifiedInstruction` (linha 6756)

O fix anterior (V16.4) já garante que `otpVerifiedInstruction` ativa com `hasRecentOTPVerification` (DB check), independente de `isFinancialActionRequest`. Isso mantém a IA em modo de coleta. **OK.**

## 🟢 Seguro — Saudação genérica suprimida (linha 6680)

O fix anterior suprime "Como posso te ajudar?" quando `hasRecentOTPVerification`. **OK.**

## Resumo das Alterações

| Prioridade | Bug | Arquivo | Fix |
|-----------|-----|---------|-----|
| 🔴 CRÍTICO | `__ai_otp_verified` nunca setado | `ai-autopilot-chat/index.ts` ~6352 | Atualizar `chat_flow_states.collected_data` com `__ai_otp_verified: true` após OTP sucesso |
| 🟡 DEFESA | Guard para `stateId` ausente | `ai-autopilot-chat/index.ts` ~6352 | `if (flow_context?.stateId)` com log warning |

## Fluxo Esperado Após Fix

```text
Cliente: "quero sacar"
→ OTP enviado (barreira financeira)

Cliente: "359019"
→ autopilot valida OTP ✅
→ SET collected_data.__ai_otp_verified = true  ← NOVO
→ "Código validado! Qual sua chave PIX?"

Cliente: "02461362270"
→ process-chat-flow verifica: __ai_otp_verified = true
→ financialIntentMatch SUPRIMIDO ✅
→ autopilot recebe, otpVerifiedInstruction ATIVO
→ "Obrigado! Qual o banco?"

Cliente: "Bradesco"
→ mesma proteção, coleta continua
→ "Qual o valor?"

Cliente: "R$ 500"
→ "Qual o motivo?"

Cliente: "comissão de vendas"
→ IA confirma e chama create_ticket ✅
```

**Uma alteração, zero risco de regressão** — apenas sincroniza o estado que o `process-chat-flow` já espera encontrar.

