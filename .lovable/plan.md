

# Fix: Ligia do Financeiro nao consegue transferir tickets

## Diagnostico

A funcao RPC `transfer_ticket_secure` valida autorizacao com 4 condicoes para agentes:
1. Ticket atribuido ao caller
2. Ticket criado pelo caller
3. Ticket sem atribuicao (assigned_to IS NULL)
4. Ticket no mesmo departamento do caller

O SELECT RLS de tickets e mais permissivo — permite que financial_agent veja tickets que criou ou que estao atribuidos a ela, independente do departamento. Isso cria um gap: Ligia ve o ticket na lista mas a RPC rejeita a transferencia.

Alem disso, a RPC usa apenas `profiles.department` (coluna legada 1:1), ignorando a tabela N:N `agent_departments`.

## Solucao

Expandir a autorizacao na RPC `transfer_ticket_secure` para:

1. Verificar tambem a tabela `agent_departments` (N:N) em vez de so `profiles.department`
2. Permitir que agentes com a permissao `inbox.transfer` habilitada possam transferir qualquer ticket que eles consigam visualizar (alinhado com o SELECT policy)

### Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.transfer_ticket_secure(
  p_ticket_id uuid, 
  p_department_id uuid, 
  p_assigned_to uuid DEFAULT NULL, 
  p_internal_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_ticket RECORD;
  v_is_authorized BOOLEAN := false;
  v_dept_name TEXT;
  v_assignee_name TEXT;
  v_has_transfer_perm BOOLEAN := false;
BEGIN
  -- 1. Buscar ticket
  SELECT id, assigned_to, created_by, department_id
  INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket nao encontrado');
  END IF;

  -- 2. Verificar autorizacao
  -- Managers/admins: acesso total
  IF has_any_role(v_caller_id, ARRAY[
    'admin','manager','general_manager',
    'cs_manager','support_manager','financial_manager'
  ]::app_role[]) THEN
    v_is_authorized := true;
  ELSIF has_any_role(v_caller_id, ARRAY[
    'support_agent','financial_agent','ecommerce_analyst','sales_rep'
  ]::app_role[]) THEN
    -- Verificar permissao inbox.transfer
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = v_caller_id
        AND rp.permission_key = 'inbox.transfer'
        AND rp.enabled = true
    ) INTO v_has_transfer_perm;

    v_is_authorized := (
      v_ticket.assigned_to = v_caller_id        -- Atribuido a ele
      OR v_ticket.created_by = v_caller_id       -- Criado por ele
      OR v_ticket.assigned_to IS NULL            -- Sem dono
      OR v_ticket.department_id IN (             -- No departamento dele (N:N)
           SELECT department_id FROM agent_departments
           WHERE profile_id = v_caller_id
         )
      OR v_has_transfer_perm                     -- Tem permissao inbox.transfer
    );
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Sem permissao para transferir este ticket'
    );
  END IF;

  -- (resto da funcao permanece igual: buscar dept name, 
  --  assignee name, executar UPDATE, criar comentario interno)
  ...
END;
$$;
```

### Mudancas Principais

1. Substituiu `profiles.department` (legado 1:1) por `agent_departments` (N:N)
2. Adicionou verificacao da permissao `inbox.transfer` como condicao alternativa
3. Usou `has_any_role` em vez de multiplos `has_role` (performance)

## Arquivos Modificados

1. **Migration SQL** — Recriar `transfer_ticket_secure` com autorizacao expandida

Nenhum arquivo frontend precisa mudar. A RPC continua com a mesma assinatura e retorno.

## Zero Regressao

- Managers/admins continuam com acesso total (nenhuma mudanca)
- Agentes que ja conseguiam transferir continuam conseguindo (as 3 condicoes originais permanecem)
- Nova condicao (agent_departments + inbox.transfer) so EXPANDE acesso, nunca restringe
- A mesma funcao e usada por `useBulkTransferTickets` e `useTicketTransfer` — ambos se beneficiam

## Testes Obrigatorios

1. Ligia (financial_agent) tenta transferir ticket atribuido a ela — deve funcionar
2. Ligia tenta transferir ticket de outro departamento que ela ve — deve funcionar (inbox.transfer = true)
3. Agente sem permissao inbox.transfer tenta transferir ticket de outro departamento — deve bloquear
4. Manager transfere qualquer ticket — deve funcionar (sem mudanca)

