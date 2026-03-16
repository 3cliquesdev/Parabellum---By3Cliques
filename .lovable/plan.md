

# Auditoria: IA Retornando "Pode repetir sua mensagem?" — Causa Raiz e Correção

## Diagnóstico

Os logs confirmam a cadeia de falhas:

```text
[ContextMemoryAgent] Falha na compressão: OpenAI Compression API error: 400
[ai-autopilot-chat] ⚠️ IA retornou vazio — tentando retry com prompt reduzido
[ai-autopilot-chat] ❌ Retry também retornou vazio
[ai-autopilot-chat] ❌ AI returned empty content after all retries, no tool calls
→ Resultado: "Pode repetir sua mensagem? Não consegui processar corretamente."
```

**Causa raiz:** O modelo configurado (`gpt-5-mini`) pertence à família de modelos de raciocínio da OpenAI que **NÃO suportam `temperature`** e exigem **`max_completion_tokens` em vez de `max_tokens`**. O código principal (`callAIWithFallback`) já trata isso corretamente, mas **3 pontos do código escapam dessa normalização**:

## Pontos de Falha

### 1. ContextMemoryAgent.ts (Crítico — causa erro 400)
O agente de compressão de memória chama a OpenAI diretamente com `temperature: 0.1`. Modelos como `gpt-5-mini` rejeitam esse parâmetro com HTTP 400. Sem a compressão, o contexto de longo prazo fica degradado.

**Correção:** Importar a lógica de normalização de modelo (remover `temperature`, converter `max_tokens` → `max_completion_tokens`) antes da chamada.

### 2. Retry com prompt reduzido (Linha ~7268 — causa resposta vazia)
Quando a IA retorna vazio na primeira tentativa, o retry cria um payload com `temperature: 0.7` e `max_tokens: 300`. Mesmo passando por `callAIWithFallback`, o payload já vem com `model` hardcoded do `ragConfig.model` (`gpt-5-mini`), e o `max_tokens` só é convertido dentro de `callAIWithFallback` se existir no payload — mas `temperature` NÃO é removida porque ela já está no array de `messages`, não no payload raiz. Na verdade, `callAIWithFallback` deleta `temperature` para modelos `MAX_COMPLETION_TOKEN_MODELS` — então esse ponto pode estar OK. A falha pode ser que o retry duplica a mensagem do user (adicionando `customerMessage` extra quando já está nos messages).

### 3. Resposta vazia sem fallback inteligente (Linha ~7333)
Quando ambas tentativas falham, o sistema cai no fallback fixo "Pode repetir sua mensagem?" em vez de tentar uma resposta contextual baseada no histórico.

## Plano de Correção

### Arquivo 1: `supabase/functions/ai-autopilot-chat/agents/ContextMemoryAgent.ts`
- Receber lista de modelos que exigem `max_completion_tokens` como parâmetro ou importar a constante
- Remover `temperature` do payload quando o modelo estiver na lista
- Adicionar `max_completion_tokens` no lugar de qualquer `max_tokens` implícito
- Usar modelo `gpt-4o-mini` como fallback fixo para compressão (tarefa background que não precisa do modelo principal) — mais barato e sem restrições de parâmetros

### Arquivo 2: `supabase/functions/ai-autopilot-chat/index.ts`
- **Retry payload (linha ~7268):** Remover `temperature` e `max_tokens` do retry payload, deixando `callAIWithFallback` normalizar automaticamente. Corrigir duplicação de mensagem do user
- **Fallback vazio (linha ~7333):** Em vez de "Pode repetir sua mensagem?", usar o `flowFallbackMessage` do fluxo se disponível, ou uma mensagem contextual baseada no `flowContextPrompt`/`flowObjective`

### Deploy
Deploy individual de `ai-autopilot-chat` apenas.

