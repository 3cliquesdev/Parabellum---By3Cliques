

# Plano: Corrigir Acesso de Gerentes ao Editor de Fluxos

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

Investiguei 3 camadas de acesso para o Ramon (role: `manager`):

| Camada | Status | Detalhe |
|---|---|---|
| Frontend (ProtectedRoute) | OK | `hasFullAccess('manager')` = true, bypass automático |
| RLS (chat_flows) | OK | Política inclui `manager` no array de roles |
| Permissão (settings.chat_flows) | OK | Habilitada para `manager` |

**A causa raiz NÃO é permissão.** Os logs do Postgres mostram dezenas de erros `canceling statement due to statement timeout` no momento exato do problema. A query `SELECT * FROM chat_flows WHERE id = :id` executada pelo editor está competindo com queries pesadas (inbox_view, conversations) que estão esgotando os recursos do banco.

Quando o timeout acontece, o `.single()` retorna erro, e o editor mostra **"Fluxo não encontrado"** — dando a impressão de bloqueio de acesso.

Além disso, há um problema de UX: o Card do fluxo **não é clicável**. O usuário precisa abrir o menu de 3 pontos e clicar "Editar", o que pode parecer que "não consegue abrir".

## Solução (2 partes)

### Parte 1: Tornar o Card do Fluxo Clicável

Adicionar `onClick` no Card para navegar direto ao editor, tornando a interação intuitiva (clique no card = abrir editor).

**Arquivo:** `src/pages/ChatFlows.tsx`
- Adicionar `onClick={() => handleEditFlow(flow)}` e `cursor-pointer` no Card

### Parte 2: Resiliência ao Timeout na Query do Editor

Melhorar a query do `useChatFlow` com retry automático para sobreviver a timeouts momentâneos.

**Arquivo:** `src/hooks/useChatFlows.tsx`
- Adicionar `retry: 2` e `retryDelay: 1000` no `useQuery` do `useChatFlow`
- Adicionar `.select("id, name, description, triggers, trigger_keywords, department_id, support_channel_id, flow_definition, is_active, is_master_flow, priority, created_by, created_at, updated_at")` explícito em vez de `*` para reduzir payload

### Parte 3: Consolidar Política RLS Duplicada

Existe uma política duplicada `support_manager_can_manage_chat_flows` que usa `has_role()` (mais lenta). Ela é redundante porque a política principal já inclui `support_manager`. Removê-la elimina overhead desnecessário.

**Migration SQL:**
```sql
DROP POLICY IF EXISTS "support_manager_can_manage_chat_flows" ON chat_flows;
```

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — nenhuma funcionalidade removida |
| Kill Switch | Não afetado |
| Fluxos existentes | Preservados — apenas melhoria de resiliência |
| Permissões | Sem mudança — política principal já cobre todos os roles |

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/ChatFlows.tsx` | Card clicável com cursor-pointer |
| `src/hooks/useChatFlows.tsx` | Retry automático + select explícito no useChatFlow |
| Migration SQL | Remover política RLS duplicada |

