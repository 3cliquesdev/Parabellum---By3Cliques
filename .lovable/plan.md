

# Plano: Atualizar process-chat-flow + Reverter Master Flow

## O que você enviou

Arquivo `process-chat-flow-index_3.ts` (5635 linhas) — uma versão diferente da edge function atual (6697 linhas). Ambas são v2.2 mas a versão atual no projeto tem ~1000 linhas a mais (possivelmente funcionalidades adicionadas depois).

## Ações

### 1. Reverter Master Flow (dados)
Restaurar o fluxo antigo como master para proteger clientes reais:
```sql
UPDATE chat_flows SET is_master_flow = false WHERE id = '9926200d-5f15-429a-ae98-9adedb2e4f65';
UPDATE chat_flows SET is_master_flow = true WHERE id = 'e44da799-c404-4c86-abe0-4aea2ca0ea1f';
```

### 2. Substituir a edge function
Copiar o arquivo enviado para `supabase/functions/process-chat-flow/index.ts`, substituindo a versão atual (6697 linhas) pela sua versão (5635 linhas). O deploy é automático.

## Risco
A versão enviada é **menor** que a atual. Pode estar faltando funcionalidades adicionadas recentemente (ex: `evaluateConditionV2Path`, `handleFetchOrderNode`, etc. que existem na versão atual mas podem estar organizadas diferente na sua). Preciso da sua confirmação de que esta é a versão correta.

## Teste
Após deploy, você testa o V4 manualmente via FlowPickerButton (ícone Workflow ⚙️) no Inbox em uma conversa específica, sem afetar clientes reais.

