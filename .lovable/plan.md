

# Fix: "duplicate key violates unique_active_flow" ao assumir conversa

## Causa raiz

A RPC `take_control_secure` (step 5) faz:
```sql
UPDATE chat_flow_states
SET status = 'transferred'
WHERE conversation_id = X AND status IN ('waiting_input','active','in_progress');
```

A constraint `unique_active_flow` é `UNIQUE(conversation_id, flow_id, status)`. Se já existe uma row com `(conversation_id, flow_id, 'transferred')` de uma execução anterior do mesmo fluxo, o UPDATE colide.

## Solução

Alterar o step 5 do `take_control_secure` para **deletar** os estados antigos com status `transferred`/`cancelled`/`completed` do mesmo `flow_id` antes de fazer o UPDATE. Alternativamente (mais simples e seguro): **deletar** os estados ativos em vez de atualizá-los para `transferred`.

A abordagem mais limpa: **DELETE** em vez de UPDATE, já que o agente está assumindo a conversa e o fluxo deve ser encerrado.

### Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.take_control_secure(p_conversation_id UUID)
RETURNS JSONB
...
AS $$
  -- (steps 1-4 iguais)
  
  -- 5. Limpar flow states ativos
  -- DELETE em vez de UPDATE para evitar colisão com unique_active_flow
  DELETE FROM chat_flow_states
  WHERE conversation_id = p_conversation_id
    AND status IN ('waiting_input', 'active', 'in_progress');
    
  -- (steps 6+ iguais)
$$;
```

### Impacto
- Sem mudança na UI (o `ActiveFlowIndicator` simplesmente não mostrará mais o fluxo ativo, que é o comportamento correto quando o agente assume)
- Consistente com o padrão de "Soberania Humana" — agente assumiu, fluxo encerra
- Zero risco de colisão de constraint

### Arquivos
- 1 migration SQL (recriar `take_control_secure` com DELETE em vez de UPDATE)

