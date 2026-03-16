

# Correção: `flowPersonaId` sobrescrito por redeclaração (Aurélio persiste)

## Problema
Existem **duas declarações** de `flowPersonaId` no mesmo escopo:

- **Linha 1506**: `let flowPersonaId = flow_context?.personaId || null;` → valor correto do portal
- **Linha 3259**: `let flowPersonaId: string | null = null;` → **sobrescreve com null**

Quando o widget envia `flow_context.personaId`, o valor é corretamente lido na linha 1506, mas é destruído na linha 3259. Na linha 3832, `flowPersonaId` é null → fallback para Aurélio.

O mesmo ocorre com `flowKbCategories`, `flowContextPrompt` e `flowFallbackMessage`.

## Correção

### `supabase/functions/ai-autopilot-chat/index.ts`

Nas linhas 3259-3262, trocar as **redeclarações** (`let x = null`) por **reatribuições condicionais** que só resetam se `flow_context` NÃO foi fornecido:

```typescript
// Antes (QUEBRADO):
let flowPersonaId: string | null = null;
let flowKbCategories: string[] | null = null;
let flowContextPrompt: string | null = null;
let flowFallbackMessage: string | null = null;

// Depois (CORRETO):
// Só resetar se NÃO veio flow_context explícito (widget/portal)
if (!flow_context) {
  flowPersonaId = null;
  flowKbCategories = null;
  flowContextPrompt = null;
  flowFallbackMessage = null;
}
```

Isso preserva os valores definidos na linha 1506-1509 quando o widget envia `flow_context`, e permite que o `process-chat-flow` (linha 3474) os popule normalmente nos outros casos.

### Redeploy
A edge function `ai-autopilot-chat` precisa ser redeployada.

## Resultado
- Widget do portal → `flowPersonaId` = persona do portal → Aurélio nunca entra
- Conversas normais (sem `flow_context`) → comportamento inalterado

