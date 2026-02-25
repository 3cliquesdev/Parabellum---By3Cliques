

# Fix da CHECK Constraint — chat_flow_states

## Status dos 3 Fixes

| Fix | Status |
|---|---|
| Re-deploy `process-chat-flow` | ✅ Concluído |
| Limpeza de estados órfãos | ✅ Já limpo (nenhum registro encontrado) |
| CHECK constraint | ✅ Concluído |

## O que falta

A constraint atual só permite:
```text
active, completed, abandoned, transferred, cancelled
```

Precisa incluir `waiting_input` e `in_progress`.

### Migration SQL a ser criada

```sql
ALTER TABLE chat_flow_states DROP CONSTRAINT IF EXISTS chat_flow_states_status_check;

ALTER TABLE chat_flow_states ADD CONSTRAINT chat_flow_states_status_check 
  CHECK (status = ANY (ARRAY[
    'active', 'waiting_input', 'in_progress', 
    'completed', 'abandoned', 'transferred', 'cancelled'
  ]));
```

### Arquivo
`supabase/migrations/20260225210000_fix_flow_states_check_constraint.sql`

### Impacto
- Regressão zero — apenas adiciona valores permitidos, não remove nenhum
- Após aplicar, o auto-avanço do `process-chat-flow` poderá salvar `waiting_input` corretamente
- O indicador de fluxo ativo voltará a funcionar

