

# Correção: "Pode repetir sua mensagem?" — Deploy Pendente

## Problema Identificado

Os logs confirmam exatamente o que acontece:

```
17:54:13 - Tentativa principal com gpt-5-mini → retorna vazio (content = null)
17:54:18 - Retry com prompt reduzido → CRASH: "selectedModel is not defined"
17:54:18 - Resultado: "Pode repetir sua mensagem? Não consegui processar corretamente."
```

**Causa raiz**: A Edge Function `ai-autopilot-chat` **não foi redeployada** após a correção do `selectedModel → (ragConfig as any)?.model`. O código fonte já está correto, mas a versão em produção ainda tem a referência quebrada.

O fluxo que deveria funcionar:
1. IA principal retorna vazio (pode acontecer) → retry é acionado
2. Retry deveria recuperar com prompt reduzido → **mas crasha por `selectedModel is not defined`**
3. Resultado: mensagem genérica "Pode repetir sua mensagem?"

## Plano

### 1. Fazer deploy de `ai-autopilot-chat`
A correção já está no código fonte (linha 7222). Basta deployar.

### 2. Investigar por que a chamada principal retorna vazio
Após o deploy, monitorar se o retry resolve ou se o problema é mais profundo (ex: prompt muito grande para gpt-5-mini, conflito de tools com max_completion_tokens, etc.)

