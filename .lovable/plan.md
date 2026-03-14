

## Plano: Aplicar Fix 1 e Fix 2 no `process-chat-flow`

Os arquivos enviados contêm 2 fixes que o arquivo atual **não** tem. O `ai-autopilot-chat` já tem o guard de mensagem vazia (linha 9213) — não precisa de alteração.

### Fix 1 — Fallback `max_interactions` (linha 3101)

**Atual:**
```typescript
const maxInteractions: number = currentNode.data?.max_ai_interactions ?? 0;
```

**Corrigido:**
```typescript
const maxInteractions: number = currentNode.data?.max_ai_interactions ?? currentNode.data?.max_interactions ?? 0;
```

Isso faz o motor respeitar o campo `max_interactions` salvo em nós antigos que não usam `max_ai_interactions`.

### Fix 2 — Guard anti-saudação (após linha 3515)

Inserir bloco que bloqueia saída prematura do nó de triagem quando a mensagem é apenas saudação ("Boa noite", "Tudo bem?") na 1ª interação:

```typescript
// Guard anti-saudação — bloquear exit intent se for a 1ª interação e mensagem for saudação
const isGreetingOnly = /^(oi|olá|ola|boa\s*(noite|tarde|manha|manhã)|tudo\s*(bem|bom|certo|ok)|e\s*ai|e aí|hey|hello|bom\s*dia|hi|opa|oi\s+tudo\s+bem)[!?.,\s]*$/i.test((userMessage || '').trim());
const greetingExitBlocked = isGreetingOnly && aiCount <= 1;

if (greetingExitBlocked && (financialIntentMatch || cancellationIntentMatch || commercialIntentMatch || supportIntentMatch || consultorIntentMatch || saqueIntentMatch || devolucaoIntentMatch || pedidosIntentMatch || sistemaIntentMatch || internacionalIntentMatch || keywordMatch || aiExitForced)) {
  console.log(`[process-chat-flow] 🛡️ Exit bloqueado — saudação na 1ª interação (aiCount=${aiCount}). Triagem deve perguntar a intenção.`);
  financialIntentMatch = false;
  cancellationIntentMatch = false;
  commercialIntentMatch = false;
  supportIntentMatch = false;
  consultorIntentMatch = false;
  saqueIntentMatch = false;
  devolucaoIntentMatch = false;
  pedidosIntentMatch = false;
  sistemaIntentMatch = false;
  internacionalIntentMatch = false;
}
```

**Nota**: O guard do arquivo enviado cobre apenas 5 intents. O atual tem 11 intents — vou incluir todos os 11 no guard para consistência.

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/process-chat-flow/index.ts` | Fix 1 (linha 3101) + Fix 2 (após linha 3515) |

### `ai-autopilot-chat/index.ts` — sem alteração

O guard de mensagem vazia já existe na versão atual (linhas 9213-9217). O arquivo enviado é uma versão anterior que **não** tem esse guard — portanto não deve substituir o atual.

