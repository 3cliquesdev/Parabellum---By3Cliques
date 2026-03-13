

# Fix Cirúrgico — 3 Mudanças no ai-autopilot-chat/index.ts

## Contexto
As variáveis `isWithdrawalRequest`, `isFinancialRequest` e `financialBarrierActive` já existem no arquivo (definidas ~linhas 5635-5823). O problema é que elas não são usadas nos 3 pontos críticos de fallback/prefixo.

## Mudanças

### FIX A — Prefixo cauteloso não aplica em requests financeiros (linha 7047)
Alterar a condição do prefixo cauteloso para excluir requests de saque/financeiro:

```typescript
// ANTES:
if (confidenceResult.action === 'cautious' && !toolCalls.length && !isEmptyAIResponse) {

// DEPOIS:
if (confidenceResult.action === 'cautious' && !toolCalls.length && !isEmptyAIResponse && !isWithdrawalRequest && !isFinancialRequest) {
```

### FIX B — Log de diagnóstico na barreira financeira (após linha 5823)
Adicionar log explícito após `financialBarrierActive` para verificar se o bloco está sendo alcançado:

```typescript
console.log('[ai-autopilot-chat] 🔐 FINANCIAL BARRIER CHECK:', {
  financialBarrierActive,
  isWithdrawalRequest,
  hasRecentOTPVerification,
  contactHasEmail,
  customerMessage: customerMessage.substring(0, 50)
});
```

### FIX C — Fallback inteligente por contexto (linha 7043)
Substituir o fallback genérico por respostas contextuais:

```typescript
// ANTES:
let assistantMessage = rawAIContent || 'Pode repetir sua mensagem? Não consegui processar corretamente.';

// DEPOIS:
let assistantMessage: string;
if (rawAIContent) {
  assistantMessage = rawAIContent;
} else if (isWithdrawalRequest) {
  assistantMessage = 'Para solicitar o saque, preciso primeiro confirmar sua identidade. Qual é o seu e-mail de cadastro?';
} else if (isFinancialRequest) {
  assistantMessage = 'Entendi sua solicitação financeira. Para prosseguir com segurança, qual é o seu e-mail de cadastro?';
} else {
  assistantMessage = 'Pode repetir sua mensagem? Não consegui processar corretamente.';
}
```

## Arquivo afetado
- `supabase/functions/ai-autopilot-chat/index.ts` — 3 edições pontuais

