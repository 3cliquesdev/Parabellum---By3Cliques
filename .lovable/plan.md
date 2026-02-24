

# Modo Persistente no Node ai_response

## Problema Atual

Quando o fluxo chega no no `ai_response`, a IA responde UMA vez. Na proxima mensagem do cliente, o motor avanca automaticamente para o proximo no via `findNextNode` (linha 857). O no de IA nao "segura" a conversa.

## Solucao

Transformar o no `ai_response` em uma zona de atendimento IA persistente com condicoes de saida configuraveis.

## Mudancas

### 1. Edge Function `process-chat-flow/index.ts` (linhas 853-857)

Adicionar tratamento especial ANTES do `findNextNode` quando `currentNode.type === 'ai_response'`:

```text
Logica atual (linha 853-857):
  else if (currentNode.type === 'condition') { ... }
  nextNode = findNextNode(flowDef, currentNode, path);

Nova logica:
  else if (currentNode.type === 'ai_response') {
    // Inicializar ou incrementar contador
    collectedData.__ai = collectedData.__ai || { interaction_count: 0 };
    collectedData.__ai.interaction_count++;

    const exitKeywords = currentNode.data?.exit_keywords || [];
    const maxInteractions = currentNode.data?.max_ai_interactions ?? 0;
    const count = collectedData.__ai.interaction_count;

    // Verificar exit keyword (case-insensitive)
    const msgLower = userMessage.toLowerCase().trim();
    const keywordMatch = exitKeywords.some(kw => 
      msgLower.includes(kw.toLowerCase().trim())
    );

    // Verificar max interacoes
    const maxReached = maxInteractions > 0 && count >= maxInteractions;

    if (keywordMatch || maxReached) {
      // SAIR: limpar __ai e avancar
      delete collectedData.__ai;
      // Cai no findNextNode normal abaixo
    } else {
      // FICAR: atualizar state e retornar aiNodeActive
      await update state com collectedData
      return { useAI: true, aiNodeActive: true, stayOnNode: true, ... }
    }
  }
  // else if condition...
  nextNode = findNextNode(flowDef, currentNode, path);
```

A resposta de "ficar" inclui todos os campos do contrato anti-alucinacao (objective, maxSentences, forbidQuestions, forbidOptions, personaId, kbCategories, fallbackMessage) para que a IA continue respondendo com as mesmas restricoes.

### 2. UI: Nova secao em `BehaviorControlsSection.tsx`

Adicionar secao "Quando sair da IA" apos as restricoes existentes:

- **Textarea "Palavras de saida"**: uma por linha (ex: "falar com atendente", "encerrar", "humano")
- **Slider "Maximo de interacoes"**: 0 = sem limite, 1 a 50
- **Alerta visual**: se max=0 e keywords vazio, exibir aviso amarelo "Sem condicao de saida configurada. A IA vai responder indefinidamente."

### 3. Node Visual: `AIResponseNode.tsx`

Novos campos na interface `AIResponseNodeData`:

```typescript
ai_persistent?: boolean;         // default: true
max_ai_interactions?: number;    // 0 = sem limite
exit_keywords?: string[];        // palavras de saida
```

Novos badges visuais:
- Badge "Loop" (icone RefreshCw, cor indigo) quando `ai_persistent !== false`
- Badge "Max N" quando `max_ai_interactions > 0`
- Badge "Keywords" com contagem quando `exit_keywords.length > 0`

### 4. Resposta de "Ficar" no node

Quando a IA permanece, o retorno inclui:

```json
{
  "useAI": true,
  "aiNodeActive": true,
  "stayOnNode": true,
  "nodeId": "currentNode.id",
  "flowId": "activeState.flow_id",
  "contextPrompt": "...",
  "useKnowledgeBase": true,
  "personaId": "...",
  "kbCategories": [...],
  "objective": "...",
  "maxSentences": 3,
  "forbidQuestions": true,
  "forbidOptions": true,
  "fallbackMessage": "...",
  "collectedData": { "__ai": { "interaction_count": 2 } }
}
```

## Fluxo Tecnico

```text
Cliente envia mensagem
  -> process-chat-flow detecta currentNode = ai_response
  -> Incrementa __ai.interaction_count em collected_data
  -> Verifica exit conditions:
     |-- Keyword match?    -> delete __ai, findNextNode, avanca
     |-- Max atingido?     -> delete __ai, findNextNode, avanca
     +-- Nenhum?           -> atualiza state, retorna aiNodeActive=true + stayOnNode=true
  -> Webhook recebe aiNodeActive=true -> chama ai-autopilot-chat
  -> IA responde ao cliente
  -> Cliente envia nova mensagem -> repete o ciclo
```

## Resumo de Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/process-chat-flow/index.ts` | Logica de persistencia antes do findNextNode |
| `src/components/chat-flows/panels/BehaviorControlsSection.tsx` | Secao "Quando sair da IA" (keywords + max slider + alerta) |
| `src/components/chat-flows/nodes/AIResponseNode.tsx` | Campos na interface + badges Loop/Max/Keywords |

## Impacto

- Zero regressao: fluxos sem ai_response ou com ai_persistent=false continuam identicos
- Upgrade: ai_response agora funciona como zona de atendimento persistente
- Kill Switch e fallback continuam respeitados (mesmo contrato anti-alucinacao)
- Seguranca: o loop e limitado pelo max_ai_interactions ou keywords de saida

