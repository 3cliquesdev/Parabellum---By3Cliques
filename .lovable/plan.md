

# Fix: Loop "Pode repetir sua mensagem?" na conversa #67A45C5C

## Diagnóstico

A conversa mostra o cliente pedindo "Quero ver meus pedidos" 4 vezes, e a IA sempre respondendo "Pode repetir sua mensagem? Não consegui processar corretamente."

### Causa raiz (logs da edge function)

```text
❌ Retry falhou: ReferenceError: messagesForAI is not defined
    at rawHandler (index.ts:6262)
⚠️ IA retornou vazio — tentando retry com prompt reduzido
❌ AI returned empty content after all retries, no tool calls
```

**Bug 1**: Na linha 7148, o bloco de retry referencia `messagesForAI` — uma variável que **não existe**. O array correto de mensagens está em `aiPayload.messages`. Isso causa um `ReferenceError`, o retry falha, `rawAIContent` fica vazio, e o sistema cai no fallback genérico da linha 7216.

**Bug 2**: Os fallbacks das linhas 7212 e 7214 ainda têm mojibake (`solicitaÃ§Ã£o`, `seguranÃ§a`).

## Correção

### Edge Function `ai-autopilot-chat/index.ts`

**Linha 7148** — Substituir variável inexistente:
```typescript
// DE:
...messagesForAI.slice(-5),

// PARA:
...aiPayload.messages.slice(-5),
```

**Linhas 7212-7216** — Corrigir encoding dos fallbacks:
```typescript
} else if (isWithdrawalRequest) {
  assistantMessage = 'Para solicitar o saque, preciso primeiro confirmar sua identidade. Qual é o seu e-mail de cadastro?';
} else if (isFinancialRequest) {
  assistantMessage = 'Entendi sua solicitação financeira. Para prosseguir com segurança, qual é o seu e-mail de cadastro?';
} else {
  assistantMessage = 'Pode repetir sua mensagem? Não consegui processar corretamente.';
}
```

## Impacto

- O retry de prompt reduzido volta a funcionar, recuperando respostas quando a primeira tentativa falha
- Os fallbacks (quando necessários) são exibidos com encoding correto
- O loop de "Pode repetir sua mensagem?" é eliminado na raiz

