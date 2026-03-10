

# Fix: IA Não Responde e Fica em Loop no Nó `ia_entrada`

## Diagnóstico

Analisei as 4 conversas e identifiquei o ciclo de falha:

1. Cliente envia mensagem → `process-chat-flow` retorna `aiNodeActive: true`
2. `ai-autopilot-chat` gera resposta com 0% confiança e 0 artigos da KB
3. A IA (GPT) gera texto como "Vou te direcionar para nosso menu de atendimento para encontrar o especialista certo!"
4. **`FALLBACK_PHRASES` NÃO detecta** essa frase ("direcionar" não está na lista)
5. A resposta passa todas as validações e é enviada ao cliente
6. O fluxo **permanece em `ia_entrada`** → cliente responde → repete o loop

Em alguns casos, a IA gera perguntas/opções proibidas → `contract_violation_blocked` → `forceAIExit` é acionado, mas o `process-chat-flow` não avança o estado corretamente.

**Resultado**: o cliente recebe 7+ vezes a mesma mensagem de fallback sem nunca ser transferido.

## Correções

### 1. Adicionar frases faltantes ao `FALLBACK_PHRASES` (ai-autopilot-chat)
Adicionar na lista `FALLBACK_PHRASES` (linha 638):
```
'direcionar para',
'encontrar o especialista',
'menu de atendimento',
'vou te direcionar',
```
Isso garante que quando a IA gera o texto do fallback configurado no nó, o detector identifica e retorna `flow_advance_needed`.

### 2. Detecção imediata: 0 artigos + 0% confiança → flow_advance (ai-autopilot-chat)
ANTES de chamar a IA (GPT), se `confidenceResult.score === 0` E `knowledgeArticles.length === 0` E existe `flow_context`, retornar `flow_advance_needed` imediatamente. Não há motivo para chamar o modelo se não tem nenhum artigo para fundamentar a resposta.

Inserir APÓS o bloco `shouldSkipHandoff` (após linha ~4720), antes de chegar na geração de resposta:
```typescript
// GUARD: 0 artigos + 0% confiança + flow_context → não gerar IA, avançar fluxo
if (flow_context && confidenceResult.score === 0 && knowledgeArticles.length === 0 && !shouldSkipHandoff) {
  return Response({ status: 'flow_advance_needed', reason: 'zero_confidence_zero_articles', hasFlowContext: true });
}
```

### 3. Detecção do fallback configurado no nó (ai-autopilot-chat)
Comparar a resposta da IA com o `flow_context.fallbackMessage` configurado no nó. Se forem similares, detectar como fallback automaticamente:
```typescript
if (flow_context?.fallbackMessage && assistantMessage.includes(flow_context.fallbackMessage.substring(0, 30))) {
  isFallbackResponse = true;
}
```

### 4. Max fallback counter anti-loop (ai-autopilot-chat)
Adicionar um contador de fallbacks consecutivos no `conversation.customer_metadata`. Se atingir 2 fallbacks seguidos para a mesma conversa no nó AI, forçar `flow_advance_needed` automaticamente, mesmo que a detecção de fallback falhe.

### 5. Corrigir conversas presas agora (SQL via insert tool)
Atualizar as 4+ conversas presas em `ia_entrada` para avançar: cancelar o flow state e mover para `waiting_human` com departamento Suporte para serem atendidas.

## Resultado Esperado
- IA com 0 artigos KB → avança imediatamente para próximo nó (sem gerar resposta inútil)
- Fallback do nó detectado → avança para próximo nó
- Máximo 2 fallbacks antes de forçar avanço → sem loops infinitos
- Conversas presas corrigidas imediatamente

