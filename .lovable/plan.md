

# Auditoria Completa: `MAX_COMPLETION_TOKEN_MODELS` + Fallback Chain

## Problemas Encontrados

### Bug 1 — `gpt-5.2` e `o4` faltando em `VALID_OPENAI_MODELS`
**L121-126:** `gpt-5.2` está em `MAX_COMPLETION_TOKEN_MODELS` mas NÃO em `VALID_OPENAI_MODELS`. Se alguém configurar `gpt-5.2`, o `sanitizeModelName` não reconhece → cai no `MODEL_MAP` → não tem entrada → vira `gpt-4o-mini`.

Mesma coisa para `o4` (mencionado nas memórias mas ausente de ambas as listas).

### Bug 2 — `sanitizeModelName` mapeia gateway → modelos antigos
**L139-152:** Mapeamentos estão errados:
```
'openai/gpt-5-mini' → 'gpt-4o-mini'   // ❌ deveria ser 'gpt-5-mini'
'openai/gpt-5'      → 'gpt-4o'        // ❌ deveria ser 'gpt-5'
'openai/gpt-5-nano' → 'gpt-4o-mini'   // ❌ deveria ser 'gpt-5-nano'
'openai/gpt-5.2'    → 'gpt-4o'        // ❌ deveria ser 'gpt-5.2'
```
Se o DB guardar o nome no formato gateway, o modelo é downgraded silenciosamente.

### Bug 3 — Fallback hardcoded `gpt-4o-mini` (L4030)
Quando o modelo principal falha com 400/422, o fallback é `gpt-4o-mini` — modelo fraco que alucina. Deveria ser `gpt-5-nano` (barato, rápido, mesma família).

### Bug 4 — `sandbox-chat` com mesmos problemas (L35-36)
Gateway names mapeiam para `gpt-4o-mini` em vez dos modelos corretos.

## Plano de Correção

| # | Arquivo | Linha | Mudança |
|---|---|---|---|
| 1 | `ai-autopilot-chat/index.ts` | L121-126 | Adicionar `'gpt-5.2'` e `'o4'` ao `VALID_OPENAI_MODELS` |
| 2 | `ai-autopilot-chat/index.ts` | L129-132 | Adicionar `'o4'` ao `MAX_COMPLETION_TOKEN_MODELS` |
| 3 | `ai-autopilot-chat/index.ts` | L139-152 | Corrigir `MODEL_MAP`: gateway names → modelos reais (`gpt-5-mini`, `gpt-5`, etc.) |
| 4 | `ai-autopilot-chat/index.ts` | L4030 | Fallback `'gpt-4o-mini'` → `'gpt-5-nano'` |
| 5 | `ai-autopilot-chat/index.ts` | L4032 | Log atualizado para `gpt-5-nano` |
| 6 | `sandbox-chat/index.ts` | L11-16 | Adicionar `'gpt-5.2'` e `'o4'` ao `VALID_OPENAI_MODELS` |
| 7 | `sandbox-chat/index.ts` | L18-21 | Adicionar `'o4'` ao `MAX_COMPLETION_TOKEN_MODELS` |
| 8 | `sandbox-chat/index.ts` | L35-36 | Corrigir fallback de gateway names → modelos reais |

### Valores corretos do MODEL_MAP:
```typescript
'openai/gpt-5-mini': 'gpt-5-mini',
'openai/gpt-5': 'gpt-5',
'openai/gpt-5-nano': 'gpt-5-nano',
'openai/gpt-5.2': 'gpt-5.2',
// Google → mantém mapeamento para OpenAI equivalente
'google/gemini-2.5-flash': 'gpt-5-mini',
'google/gemini-2.5-flash-lite': 'gpt-5-nano',
'google/gemini-2.5-pro': 'gpt-5',
'google/gemini-3-pro-preview': 'gpt-5',
'google/gemini-3-flash-preview': 'gpt-5-mini',
'google/gemini-3.1-pro-preview': 'gpt-5',
'google/gemini-3.1-flash-image-preview': 'gpt-5-mini',
'google/gemini-3-pro-image-preview': 'gpt-5',
```

Fix cirúrgico em 2 arquivos, zero mudança de lógica — apenas corrige mapeamentos e fallback.

