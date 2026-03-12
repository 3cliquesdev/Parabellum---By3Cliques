

# Plano: Adicionar GPT-5/Mini + Corrigir Bug Crítico de Modelo

## Problemas Encontrados

### Bug Crítico: Modelo configurado na UI nunca é usado
O `callAIWithFallback` (L3831) **hardcoda** `model: 'gpt-4o-mini'` — o modelo selecionado na UI (`ragConfig.model`) nunca chega à chamada da OpenAI. Trocar modelo no painel não tem efeito nenhum.

### Modelos GPT-5 ausentes
A OpenAI já disponibiliza `gpt-5`, `gpt-5-mini` e `gpt-5-nano` na API direta, mas não estão na lista.

### Modelos Reasoning incompatíveis
Os modelos `o3`, `o3-mini`, `o4-mini` usam `max_completion_tokens` em vez de `max_tokens` na API OpenAI. Se alguém selecionar esses modelos, a chamada pode falhar.

## Mudanças

### 1. `src/hooks/useRAGConfig.tsx` — Adicionar GPT-5 family
Adicionar 3 modelos:
- `gpt-5` (Chat, Premium+)
- `gpt-5-mini` (Chat, Balanceado)  
- `gpt-5-nano` (Chat, Econômico)

### 2. `src/components/settings/AIModelConfigCard.tsx` — Adicionar GPT-5 family
Mesmos 3 modelos no seletor visual.

### 3. `supabase/functions/ai-autopilot-chat/index.ts` — 3 correções

**3a. Bug crítico**: `callAIWithFallback` deve usar `ragConfig.model` em vez de hardcoded `'gpt-4o-mini'`:
```typescript
// ANTES (L3831):
body: JSON.stringify({ model: 'gpt-4o-mini', ...payload }),

// DEPOIS:
body: JSON.stringify({ model: ragConfig.model, ...payload }),
```

**3b. Compatibilidade reasoning models**: Converter `max_tokens` → `max_completion_tokens` para modelos o3/o4:
```typescript
// No aiPayload, antes de enviar:
if (['o3','o3-mini','o4-mini'].includes(ragConfig.model)) {
  if (payload.max_tokens) {
    payload.max_completion_tokens = payload.max_tokens;
    delete payload.max_tokens;
  }
}
```

**3c. VALID_OPENAI_MODELS**: Adicionar `gpt-5`, `gpt-5-mini`, `gpt-5-nano` ao Set.

### 4. `supabase/functions/sandbox-chat/index.ts` — Atualizar sanitizer
Adicionar GPT-5 family como modelos válidos.

### 5. Outras edge functions (hardcoded `gpt-4o-mini`)
Funções auxiliares como `generate-kb-draft`, `expand-query`, `extract-knowledge-from-chat`, etc. continuam com `gpt-4o-mini` hardcoded — isso é **intencional** pois são tarefas internas simples que não precisam do modelo premium configurado pelo usuário. Sem alteração necessária.

## Fluxo não afetado
O `process-chat-flow` delega ao `ai-autopilot-chat` via `supabase.functions.invoke()` — não chama a OpenAI diretamente. Portanto, o fluxo não é afetado pela migração.

## Resumo

| Arquivo | Correção |
|---|---|
| `useRAGConfig.tsx` | +3 modelos GPT-5 |
| `AIModelConfigCard.tsx` | +3 modelos GPT-5 |
| `ai-autopilot-chat/index.ts` | Bug modelo hardcoded + reasoning compat + GPT-5 valid |
| `sandbox-chat/index.ts` | GPT-5 no sanitizer |

Total: **4 arquivos**, sendo 1 bug crítico (modelo ignorado) + 3 modelos novos + compatibilidade reasoning.

