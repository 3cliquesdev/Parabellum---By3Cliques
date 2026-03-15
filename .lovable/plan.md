

# Fix: IA de destino ignora contexto da conversa após transferência entre nós

## Problema
Quando a triagem (Clicker) transfere para o Helper, o Helper começa do zero — como se fosse uma conversa nova. Apesar do histórico de mensagens (últimas 6) ser passado no payload, **nenhuma instrução no system prompt** diz ao Helper para ler e continuar a conversa.

O prompt restritivo (quando `useRestrictedPrompt = true`) agrava o problema dizendo "Responda SOMENTE ao seguinte objetivo", fazendo a IA ignorar completamente o contexto anterior.

## Causa raiz
- `messageHistory.slice(-6)` é incluído nos `messages` do payload — a IA tecnicamente "vê" o histórico
- Mas o `contextualizedSystemPrompt` não contém instrução de **continuidade conversacional**
- Cada persona trata a conversa como se fosse a primeira interação

## Correção

### Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`

**1. Injetar instrução de continuidade quando há `flow_context` + histórico existente**

Após montar `messageHistory` (linha ~4060), gerar um resumo compacto do contexto anterior e injetá-lo no system prompt:

```
Se há flow_context E messageHistory.length > 1:
  → Adicionar ao início do contextualizedSystemPrompt:
  
  "⚡ CONTINUIDADE: Você está assumindo uma conversa em andamento.
   O cliente já interagiu com outro assistente (triagem).
   LEIA o histórico de mensagens abaixo para entender o contexto.
   NÃO repita saudações. NÃO peça informações já fornecidas.
   Continue a conversa naturalmente de onde parou."
```

**2. Gerar mini-resumo do histórico para o prompt restritivo**

Quando `useRestrictedPrompt = true`, o prompt restritivo é muito curto e a IA tende a ignorar o `messageHistory` nos messages. Solução:

- Extrair das últimas N mensagens um resumo textual (ex: "O cliente perguntou sobre X, o assistente anterior respondeu Y")
- Injetar esse resumo diretamente no system prompt restritivo, dentro de uma seção `Contexto da Conversa Anterior:`
- Isso garante que mesmo com prompt restritivo, a IA saiba o que já foi discutido

**3. Aumentar `maxHistory` quando há transição entre nós**

Atualmente `maxHistory = 10` e depois `slice(-6)`. Quando há `flow_context`, aumentar o slice para 10 mensagens para dar mais contexto ao novo agente.

### Resultado esperado
- Helper começa com "Entendi, você está com dúvida sobre X..." em vez de "Olá! Como posso ajudar?"
- IA não repete saudações
- IA não pede informações já coletadas pelo Clicker
- Transição transparente para o cliente

