

# Fix: Toda transferência vincula ao setor de destino

## Problema
Quando o fluxo detecta uma intenção (comercial, financeiro, etc.) e navega para um nó de transferência, o `department` da conversa só é atualizado **depois** que o webhook recebe o resultado do `process-chat-flow`. Enquanto isso, a conversa fica no departamento original (ex: Suporte com auto-close de 5 min), e se o cliente demora, é encerrada antes de chegar ao destino.

## Solução

### 1. Atualizar department imediatamente no `process-chat-flow`
**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

Em **todos os pontos** onde o flow retorna `transfer: true` com um `departmentId`, atualizar o `department` da conversa **antes** de retornar o resultado ao webhook. Isso garante que a conversa já esteja vinculada ao setor correto independente de latência no webhook.

Pontos de alteração (6 locais que retornam `transfer: true`):
- Nó de transferência direto (~linha 4600)
- Transfer por intent comercial (~linha 4982)  
- Transfer de nó master flow (~linha 5666)
- Transfer de matched flow (~linha 6042)
- Transfer por OTP non-compliant (~linha 2019)
- Transfer por OTP max attempts (~linha 2439)

Em cada um, adicionar antes do `return`:
```typescript
if (departmentId) {
  await supabaseClient
    .from('conversations')
    .update({ department: departmentId })
    .eq('id', conversationId);
  console.log(`[process-chat-flow] 🏢 Department atualizado imediatamente: ${departmentId}`);
}
```

### 2. Safety net no auto-close (Stage 3 e 3b)
**Arquivo:** `supabase/functions/auto-close-conversations/index.ts`

Antes de fechar uma conversa no Stage 3/3b, verificar se existe um `chat_flow_state` ativo com `ai_exit_intent` definido (comercial, financeiro, etc.). Se sim, em vez de fechar, transferir para o departamento correto com `ai_mode: 'waiting_human'`.

Lógica:
```
- Buscar chat_flow_state ativo para a conversa
- Se tem ai_exit_intent no collected_data → mapear para departmentId
- Atualizar conversa: department = destino, ai_mode = 'waiting_human'
- NÃO fechar
```

Mapa de intents → departamentos:
- `comercial` → Comercial Nacional
- `internacional` → Comercial Internacional  
- `financeiro` → Financeiro
- `cancelamento` → CS
- Outros → manter no departamento atual (fechar normalmente)

### 3. Deploy
- `process-chat-flow`
- `auto-close-conversations`

## Resultado
- Toda transferência atualiza o department imediatamente no motor de fluxos
- Auto-close não fecha conversas que estão em trânsito para outro setor
- Se o cliente demora, a conversa é transferida para humano no setor correto em vez de ser encerrada

