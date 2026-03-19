

# Fix: Guard OTP no Fallback de Resposta Vazia

## Problema
Linha 7766: quando a LLM retorna resposta vazia e `isFinancialActionRequest` é true, o fallback **sempre** dispara mensagem de OTP — mesmo que o OTP já tenha sido verificado (`hasRecentOTPVerification === true`). Isso causa re-envio desnecessário de OTP após verificação bem-sucedida.

## Causa Raiz
O bloco `else if (isFinancialActionRequest)` na linha 7766 não verifica `hasRecentOTPVerification`. A `otpVerifiedInstruction` está corretamente injetada no prompt (linha 6747), mas quando a LLM retorna vazio mesmo assim, o fallback ignora o estado de verificação.

## Solução

### Arquivo: `supabase/functions/ai-autopilot-chat/index.ts` (linhas 7766-7772)

Adicionar guard `hasRecentOTPVerification` no fallback:

```typescript
} else if (isFinancialActionRequest && !hasRecentOTPVerification) {
  // OTP ainda NÃO verificado — pedir email ou enviar código
  if (contactHasEmail) {
    assistantMessage = 'Identificamos seu cadastro. Para prosseguir com segurança, vou enviar um código de verificação para o seu e-mail. Um momento!';
  } else {
    assistantMessage = 'Para prosseguir com sua solicitação financeira, preciso confirmar sua identidade. Qual é o seu e-mail de compra?';
  }
} else if (isFinancialActionRequest && hasRecentOTPVerification) {
  // OTP JÁ verificado — iniciar coleta de dados financeiros
  assistantMessage = 'Sua identidade já foi verificada com sucesso! ✅ Para prosseguir com sua solicitação, preciso de alguns dados. Qual é a sua chave PIX?';
}
```

**Uma única alteração em um único arquivo.** O novo branch pós-OTP inicia a coleta de dados (PIX) em vez de re-disparar verificação.

