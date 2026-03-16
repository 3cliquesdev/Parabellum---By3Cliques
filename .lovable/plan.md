

# Deploy get-inbox-counts + Fix 24 Build Errors

## 1. Deploy `get-inbox-counts`

O código Anti-Thundering Herd (Promise Coalescing) já está sincronizado na main (confirmado pelo diff). Vou fazer deploy direto da função.

## 2. Fix dos 24 Erros de Build (10 arquivos)

Todos são erros de tipagem TypeScript que não quebram runtime (Deno não faz type-check), mas impedem deploys limpos. Correções mínimas e cirúrgicas:

| Arquivo | Erros | Correção |
|---------|-------|----------|
| `ai-autopilot-chat` | 1 | `selectedModel` → `ragConfig.model` (L7222) |
| `error-digest` | 1 | `err.message` → `(err as Error).message` (L90) |
| `handle-whatsapp-event` | 2 | Tipar `e` como `any` (L977); `instanceId` → `instance.id` (L1374) |
| `meta-whatsapp-webhook` | 5 | Adicionar `department_id` ao select (L550/571); cast `flowData` e `activeFlowState.chat_flows` com `as any` (L924/2335) |
| `process-chat-flow` | 5 | `products as string[]` (L100/107); `collectedData` → `{}` nos 3 pontos fora de escopo (L1484/4936/5589); `stateId!` ou `stateId \|\| ''` (L5326) |
| `process-playbook-queue` | 1 | Cast `(failedExecution as any)?.execution_context` (L397) |
| `route-conversation` | 3 | Adicionar `agent_departments(department_id)` ao select (L421-432) |
| `send-meta-whatsapp` | 1 | Adicionar `metadata?: Record<string, any>` ao interface (L167) |
| `submit-form` | 1 | Mover `pipeline_id` para escopo externo ao `else` ou usar variável separada com fallback (L158) |
| `transition-conversation-state` | 2 | Wrap insert em `Promise.resolve(...)` e tipar `(e: any)` (L218) |
| `validate-by-cpf` | 1 | `error.message` → `(error as Error).message` (L176) |

## Execução

1. Corrigir todos os 24 erros em paralelo (edições mínimas, sem mudar lógica)
2. Deploy `get-inbox-counts` 
3. Verificar logs para confirmar latência e coalescing ativo

