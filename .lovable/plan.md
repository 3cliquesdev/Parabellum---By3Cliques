

# Bug: Clientes Não Passam do 2o Nó — `skipInitialMessage` Bloqueia Saudação da IA

## Diagnóstico

Ambas as conversas (#A297D687 e #1EE7AFFA) seguem o mesmo padrão:

```text
Cliente → "Bom dia" → Menu Produto → "1" → Menu Assunto → "2"/"3" → [SILÊNCIO] → Auto-close
```

O fluxo navega corretamente até o nó de IA (node_ia_financeiro / node_ia_sistema), mas **a IA nunca responde**. Resultado: `ai_msg_count = 0` em ambas.

Conversas anteriores (antes do deploy recente) funcionam normalmente com 3-8 mensagens de IA.

## Causa Raiz

O flag `skipInitialMessage` foi adicionado no deploy recente para evitar que o dígito de menu ("2", "3") fosse enviado como mensagem real ao autopilot. Porém, no `meta-whatsapp-webhook` (linha 1148-1150), quando este flag é `true`, o código executa `continue` — **pulando completamente a chamada à IA**:

```typescript
if (flowData.skipInitialMessage === true) {
  console.log("skipInitialMessage=true — ignorando dígito...");
  continue;  // ← BUG: nunca chama a IA, cliente fica sem resposta
}
```

O cliente fica esperando uma saudação que nunca chega, e após ~8 minutos o auto-close encerra a conversa.

## Impacto

**Todo cliente que navega pelo menu e chega a um nó de IA fica sem resposta.** Afeta 100% dos novos atendimentos via WhatsApp Meta.

## Correção

Em vez de `continue`, chamar a IA com `customerMessage: ""` (vazio) para acionar a saudação proativa:

### 1. `meta-whatsapp-webhook/index.ts` (linhas 1148-1150)

Substituir o `continue` por uma chamada ao autopilot com mensagem vazia e o `flow_context` completo. O objetivo é que a IA envie sua saudação ("Olá! Sou Helper Financeiro...") sem processar o dígito de menu como pergunta do cliente.

### 2. `process-buffered-messages/index.ts` (linhas 148-153)

Mesmo fix: quando `skipInitialMessage=true` e a mensagem concatenada é só dígito, chamar a IA com mensagem vazia em vez de marcar como processado e ignorar.

### 3. Deploy

Redeploy de `meta-whatsapp-webhook` e `process-buffered-messages`.

