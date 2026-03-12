

# Auditoria: Modelo do Agente Helper + Erros Residuais

## Onde configurar o modelo do agente Helper

O modelo de IA **não é configurado por persona**. Todas as personas (Helper, Nexxo Suporte, etc.) usam o **mesmo modelo global**, configurado em:
- **Configurações → IA → Card "Modelo de IA"** (`AIModelConfigCard`)
- Ou no **AI Trainer** (rota `/ai-trainer`)
- Ou no widget **Orquestrador RAG** (`RAGOrchestratorWidget`)

Todos escrevem na mesma chave `ai_default_model` do banco. O modelo é compartilhado entre todas as personas.

## Erros Encontrados

### 1. `AITrainer.tsx` — GPT-5 ausente
A lista `AVAILABLE_MODELS` (L19-30) tem apenas 8 modelos e **não inclui GPT-5, GPT-5 Mini, GPT-5 Nano**. As outras listas (`useRAGConfig.tsx` e `AIModelConfigCard.tsx`) já foram atualizadas, mas esta ficou para trás.

### 2. Fluxo não afetado ✅
Confirmado: `process-chat-flow` delega ao `ai-autopilot-chat` que já usa `ragConfig.model` com sanitização + compatibilidade reasoning. Sem impacto.

### 3. Backend OK ✅
- `ai-autopilot-chat`: `callAIWithFallback` usa `ragConfig.model` (corrigido anteriormente)
- `sandbox-chat`: usa `getConfiguredAIModel()` com `VALID_OPENAI_MODELS` incluindo GPT-5
- Reasoning models: `max_completion_tokens` conversion OK em ambos

## Correção Necessária

| Arquivo | Correção |
|---|---|
| `src/pages/AITrainer.tsx` L19-30 | Adicionar `gpt-5`, `gpt-5-mini`, `gpt-5-nano` à lista `AVAILABLE_MODELS` |

**1 arquivo, 1 correção.** Tudo o mais está 100%.

