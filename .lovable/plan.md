

# Liberar consultores para atribuir tickets via RPC segura

## Problema
O `consultant` não consegue atribuir tickets porque `useUpdateTicket` faz `UPDATE` direto na tabela `tickets`, e a RLS só libera consultores para tickets da própria carteira. Tickets fora da carteira (como o da Vanessa com `consultant_id = null`) são bloqueados.

## Solução
Criar uma RPC `assign_ticket_secure` (SECURITY DEFINER) que permite consultores atribuírem tickets, e usar essa RPC no frontend em vez do update direto.

### 1. Migration SQL — criar `assign_ticket_secure`

```sql
CREATE OR REPLACE FUNCTION public.assign_ticket_secure(
  p_ticket_id uuid,
  p_assigned_to uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := false;
BEGIN
  -- Managers/admins: acesso total
  IF has_any_role(v_caller_id, ARRAY[
    'admin','manager','general_manager',
    'cs_manager','support_manager','financial_manager'
  ]::app_role[]) THEN
    v_is_authorized := true;
  -- Agentes operacionais e consultores podem atribuir
  ELSIF has_any_role(v_caller_id, ARRAY[
    'support_agent','financial_agent','consultant',
    'ecommerce_analyst','sales_rep'
  ]::app_role[]) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  UPDATE tickets
  SET assigned_to = p_assigned_to,
      status = CASE 
        WHEN p_assigned_to IS NOT NULL AND status = 'open' THEN 'in_progress'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', true, 'ticket_id', p_ticket_id);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_ticket_secure(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_ticket_secure(uuid, uuid) TO authenticated;
```

### 2. `src/components/TicketDetails.tsx` — usar RPC na atribuição

Mudar `handleAssignChange` de:
```ts
updateTicket.mutate({ id: ticket.id, updates: { assigned_to: ... } });
```
Para:
```ts
const { data } = await supabase.rpc('assign_ticket_secure', {
  p_ticket_id: ticket.id,
  p_assigned_to: userId === 'unassigned' ? null : userId,
});
```

Manter toast, invalidação de queries e evento de atribuição após sucesso.

### Resultado
- Consultores podem atribuir qualquer ticket visível sem precisar de outro role
- Segurança mantida via validação de role dentro da RPC
- Padrão consistente com `transfer_ticket_secure` já existente

