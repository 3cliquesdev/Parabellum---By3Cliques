

# Fix: Saudação Proativa Bloqueia Processamento da Mensagem do Cliente

## Problema
Na linha 7273 de `ai-autopilot-chat/index.ts`, após enviar a saudação proativa ("Olá! Sou Laís..."), o código faz `return` imediatamente. Isso significa que a **mensagem real do cliente nunca chega à LLM** — o Modo Jarvis é efetivamente desligado na primeira interação. O cliente precisa enviar a mensagem de novo para ser respondido.

## Causa Raiz
```text
Linha 7232: skipLLMForGreeting = true;
Linha 7273: return new Response(...) ← RETORNA SEM PROCESSAR A MENSAGEM
Linha 7279: const aiData = await callAIWithFallback(aiPayload); ← NUNCA ALCANÇADO
```

## Solução
Remover o `return` prematuro e, em vez disso, deixar o fluxo continuar para o `callAIWithFallback`. A saudação já foi salva e enviada ao WhatsApp — agora o código deve **também** processar a mensagem do cliente pela LLM e retornar a resposta completa (saudação + resposta da IA juntas, ou apenas a resposta após a saudação já ter sido enviada separadamente).

**Abordagem**: Como a saudação já foi persistida como mensagem separada e enviada ao WhatsApp, basta **remover o `return` na linha 7273** e deixar a execução continuar normalmente até a LLM processar a mensagem do cliente. A flag `skipLLMForGreeting` (linha 7232) precisa ser removida ou ignorada, já que queremos que a LLM processe.

### Alteração concreta (linhas 7232, 7273-7275)
1. **Linha 7232**: Remover `skipLLMForGreeting = true` (ou não usá-la para bloquear)
2. **Linhas 7273-7275**: Substituir o `return` por um log, permitindo que o fluxo continue:
```typescript
// Saudação enviada — agora continuar para processar a mensagem do cliente pela LLM
console.log('[ai-autopilot-chat] Saudação proativa enviada, continuando para processar mensagem do cliente');
```

Isso garante que:
- A saudação é enviada como mensagem separada (já funciona)
- A mensagem do cliente é processada pela LLM normalmente (Jarvis continua ativo)
- O cliente recebe **duas mensagens**: a saudação + a resposta real

## Deploy
- Editar `supabase/functions/ai-autopilot-chat/index.ts` (linhas 7232 e 7273-7275)
- Redeploy da Edge Function `ai-autopilot-chat`

