

# Auditoria Final: `max_tokens` vs `max_completion_tokens` + Strict RAG model

## Situação

Zero `gpt-4o-mini` hardcoded nas edge functions. Porém, **5 locais** ainda usam `max_tokens` diretamente com modelos `gpt-5-*` (que exigem `max_completion_tokens`), causando erro 400 silencioso.

## Problemas Encontrados

| # | Arquivo | Linha | Bug | Correção |
|---|---|---|---|---|
| 1 | `ai-auto-trainer/index.ts` | L210 | `max_tokens: 2000` com `aiModel` (gpt-5-mini) — chamada direta à OpenAI, sem conversão | → `max_completion_tokens: 2000` + remover `temperature` se reasoning |
| 2 | `ai-chat-stream/index.ts` | L207-208 | `max_tokens: 1024` com `aiModel` (gpt-5-mini) — chamada direta | → `max_completion_tokens: 1024` |
| 3 | `import-octadesk/index.ts` | L158-159 | `temperature: 0.3, max_tokens: 1500` com `gpt-5-nano` hardcoded | → `max_completion_tokens: 1500`, remover `temperature` |
| 4 | `sandbox-chat/index.ts` | L178, L437, L442-444 | `isReasoningModel` só checa `['o3', 'o3-mini', 'o4-mini']`, ignora gpt-5 family | → Usar `MAX_COMPLETION_TOKEN_MODELS.has()` em vez de array inline |
| 5 | `ai-autopilot-chat/index.ts` | L4024-4028 | Fallback `gpt-5-nano` recebe `max_tokens` (L4026-4027) em vez de `max_completion_tokens` | → Converter para `max_completion_tokens` |
| 6 | `ai-autopilot-chat/index.ts` | L4105 | `gpt-4o` no Strict RAG — funcional mas inconsistente com política de usar gpt-5 | → `gpt-5` + `max_completion_tokens: 400` |

## Nota sobre Frontend

Os arquivos `src/` (`AIModelConfigCard.tsx`, `RAGOrchestratorWidget.tsx`, `AITrainer.tsx`, `useRAGConfig.tsx`) mantêm `gpt-4o-mini` como **opção de seleção para o usuário** — isso é correto e não deve ser alterado. O usuário pode querer escolher esse modelo.

## Plano

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `ai-auto-trainer/index.ts` L210 | `max_tokens` → `max_completion_tokens` |
| 2 | `ai-chat-stream/index.ts` L208 | `max_tokens` → `max_completion_tokens` |
| 3 | `import-octadesk/index.ts` L158-159 | Remover `temperature`, `max_tokens` → `max_completion_tokens` |
| 4 | `sandbox-chat/index.ts` L178, L437, L442-444 | Substituir arrays inline `['o3', 'o3-mini', 'o4-mini']` por `MAX_COMPLETION_TOKEN_MODELS.has()` |
| 5 | `ai-autopilot-chat/index.ts` L4024-4028 | No fallback gpt-5-nano: usar `max_completion_tokens` em vez de `max_tokens` |
| 6 | `ai-autopilot-chat/index.ts` L4105, L4111 | Strict RAG: `gpt-4o` → `gpt-5`, `max_tokens` → `max_completion_tokens` |

Resultado: **zero chamadas diretas à OpenAI com parâmetro errado**. O `callAIWithFallback` já converte internamente, mas chamadas diretas (fora dele) precisam do parâmetro correto.

