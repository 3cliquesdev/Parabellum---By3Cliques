

# Fix: 8 Build Errors Blocking Deploy + Deploy Edge Functions

Existem **8 erros de TypeScript** em 3 edge functions que impedem o deploy. Todos são problemas de tipagem simples.

## Erros e Correções

### 1. `process-chat-flow/index.ts` — 5 erros

**Erro A (linha 100)**: `unknown[]` não é assignable a `string[]`
- **Fix**: Adicionar `as string[]` no final do spread do Set

**Erros B-E (linhas 2967, 2993, 4355, 4427)**: `selectedOption` não existe no escopo
- `selectedOption` é declarado na linha 3063 dentro de um bloco `if (currentNode.type === 'ask_options')`, mas referenciado em blocos anteriores (auto-advance) onde não existe
- **Fix**: Substituir `selectedOption` por `collectedData[currentNode.data?.save_as || 'choice']` que já contém o valor salvo da opção selecionada, e usar `String(savedChoice)` em vez de `selectedOption.label`

### 2. `meta-whatsapp-webhook/index.ts` — 2 erros

**Erros F-G (linhas 927, 944)**: `metadata` não existe no tipo do select
- As 3 queries de conversation (linhas 551, 572, 580) selecionam campos sem `metadata`, mas depois usam `conversation.metadata`
- **Fix**: Adicionar `, metadata` nos 3 `.select()` de conversations

### 3. `route-conversation/index.ts` — 1 erro

**Erro H (linha 477)**: `department_id` em tipo `never`
- PostgREST infere o tipo errado para `a.agent_departments` quando não é array
- **Fix**: Cast para `(a.agent_departments as any)?.department_id`

## Após Fixes — Deploy

Fazer deploy das 3 edge functions afetadas + `ai-autopilot-chat`:
- `process-chat-flow`
- `meta-whatsapp-webhook`
- `route-conversation`
- `ai-autopilot-chat` (mudanças de humanização pendentes)

**Total: ~10 linhas alteradas em 3 arquivos + deploy de 4 functions**

