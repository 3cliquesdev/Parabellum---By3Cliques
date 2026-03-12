

# Plano: Auditoria Final — Corrigir Últimos Erros Residuais

## Auditoria Completa

Verifiquei todos os arquivos do frontend e das 3 edge functions principais. A migração está **95% completa**. Encontrei **3 problemas** a corrigir:

## Problemas Encontrados

### 1. `sandbox-chat/index.ts` L456-459 — Mensagem de erro ainda menciona "Lovable workspace"
```typescript
// ATUAL (errado):
'Payment required. Please add credits to your Lovable workspace.'
// CORRETO:
'Erro de billing na API OpenAI. Verifique sua conta OpenAI.'
```

### 2. `sandbox-chat/index.ts` L420-425 — `max_completion_tokens` em modelos Chat causa erro
O payload usa `max_completion_tokens` para **todos** os modelos, mas modelos Chat (GPT-4o, GPT-4.1, GPT-5) usam `max_tokens`. Apenas modelos Reasoning (o3, o4-mini) usam `max_completion_tokens`.

**Correção**: Usar `max_tokens` por padrão, converter para `max_completion_tokens` apenas se o modelo for Reasoning.

### 3. `sandbox-chat/index.ts` L163 — Mesmo problema no intent classification
Usa `max_completion_tokens: 10` para classificação de intenção. Se o modelo configurado for Chat, isso pode causar erro na API OpenAI (campo não reconhecido em modelos não-reasoning).

**Correção**: Usar `max_tokens` por padrão, converter condicionalmente.

## Fluxo não afetado
Confirmado: `process-chat-flow` delega ao `ai-autopilot-chat` via `supabase.functions.invoke()`. O `ai-autopilot-chat` já tem `REASONING_MODELS` + conversão correta de tokens. O fluxo principal está 100%.

## Resumo

| Arquivo | Correção |
|---|---|
| `sandbox-chat/index.ts` L456-459 | Mensagem "Lovable workspace" → "OpenAI" |
| `sandbox-chat/index.ts` L420-425 | `max_completion_tokens` → `max_tokens` (+ conversão para reasoning) |
| `sandbox-chat/index.ts` L149-164 | Mesmo fix para intent classification |

Total: **3 correções** em 1 arquivo. Nenhuma mudança de lógica no fluxo principal.

