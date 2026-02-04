

# Plano: Diagnóstico e Correção dos 3 Problemas

## Resumo dos Achados

| Problema | Status | Causa |
|----------|--------|-------|
| Time comercial não vê deals | JA CORRIGIDO | Migration aplicada; possível cache/deploy |
| Caroline não transfere tickets | INVESTIGAR | Possivelmente tentando transferir ticket de terceiros |
| Gerente CS criar usuários | FUNCIONA | users.manage=TRUE para cs_manager |

---

## 1. TIME COMERCIAL - Deals

### Status Atual
A migration anterior JA adicionou role `user` nas políticas RLS:

```sql
role_based_select_deals:
  (has_role(auth.uid(), 'user'::app_role) AND (assigned_to = auth.uid()))
```

### Possíveis Causas do Problema Persistir
1. **Erro de Deploy 429**: O log mostrou `deployment to cloudflare failed: 429 rate limit`. A migration pode não ter sido aplicada completamente.
2. **Cache do navegador**: Usuários podem estar com versão antiga.

### Ação Recomendada
- Aguardar re-deploy automático ou forçar novo deploy
- Pedir para usuários limparem cache (Ctrl+Shift+R)

---

## 2. CAROLINE LAMONICA - Transferência de Tickets

### Dados Confirmados
- ID: `a65f7160-80b7-4bcb-8634-b39eafc96bbd`
- Email: `caroline.lamonica@3cliques.net`
- Role: `support_agent`
- Permissão: `tickets.assign = TRUE`, `inbox.transfer = TRUE`

### Lógica da RPC `transfer_ticket_secure`
A função permite que `support_agent` transfira SE:

```sql
v_is_authorized := (
  v_ticket.assigned_to = v_caller_id      -- ticket atribuído a ela
  OR v_ticket.created_by = v_caller_id    -- ticket criado por ela
  OR v_ticket.assigned_to IS NULL         -- ticket sem atribuição
);
```

### Possível Causa do Erro
Caroline pode estar tentando transferir um ticket que:
- Está atribuído a **outra pessoa** (não é dela)
- E ela não criou

### Ação para Corrigir
Atualizar a RPC para permitir que `support_agent` possa transferir **qualquer ticket do mesmo departamento** (não só os dela).

### SQL Proposto

```sql
-- Atualizar transfer_ticket_secure para permitir support_agent
-- transferir tickets do mesmo departamento

-- Na parte de autorização, adicionar verificação de departamento:
ELSIF has_role(v_caller_id, 'support_agent'::app_role)
THEN
  -- Verificar se agente está no mesmo departamento do ticket
  SELECT department INTO v_caller_dept FROM profiles WHERE id = v_caller_id;
  v_is_authorized := (
    v_ticket.assigned_to = v_caller_id 
    OR v_ticket.created_by = v_caller_id 
    OR v_ticket.assigned_to IS NULL
    OR v_ticket.department_id = v_caller_dept  -- NOVO: mesmo departamento
  );
END IF;
```

---

## 3. GERENTE CS - Criar Usuários

### Status Confirmado
```
cs_manager | users.manage | enabled = TRUE
```

Marco Cruz (cs_manager) TEM a permissão habilitada.

### Se ainda não funciona, possíveis causas:
1. **Cache de permissões no frontend**: O hook `useRolePermissions` tem `staleTime: 60s`
2. **Edge function não sendo chamada**: Verificar console
3. **Erro na edge function**: Verificar logs

### Debug Implementado
Na migration anterior, adicionamos logs na edge function `create-user`:

```typescript
console.log('[create-user] Permission check:', {
  caller_id: user.id,
  caller_role: userRole?.role,
  permission_key: 'users.manage',
  permission_enabled: permission?.enabled,
  is_admin: isAdmin,
  has_permission: hasPermission
});
```

### Como Testar
1. Marco Cruz faz login
2. Tenta criar usuário
3. Verificar logs da edge function `create-user`
4. Se não aparecer log, o frontend não está chamando a função

---

## Implementação Proposta

### Migration SQL

```sql
-- Expandir autorização de support_agent para transferir tickets do mesmo dept
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
  v_caller_dept UUID;
BEGIN
  -- 1. Buscar ticket
  SELECT id, assigned_to, created_by, department_id
  INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket não encontrado');
  END IF;

  -- 2. Buscar departamento do caller
  SELECT department INTO v_caller_dept FROM profiles WHERE id = v_caller_id;

  -- 3. Verificar autorização
  IF has_role(v_caller_id, 'admin'::app_role) 
     OR has_role(v_caller_id, 'manager'::app_role)
     OR has_role(v_caller_id, 'general_manager'::app_role)
     OR has_role(v_caller_id, 'cs_manager'::app_role)
     OR has_role(v_caller_id, 'support_manager'::app_role)
     OR has_role(v_caller_id, 'financial_manager'::app_role)
  THEN
    v_is_authorized := true;
  ELSIF has_role(v_caller_id, 'support_agent'::app_role) 
        OR has_role(v_caller_id, 'financial_agent'::app_role)
        OR has_role(v_caller_id, 'ecommerce_analyst'::app_role)
        OR has_role(v_caller_id, 'sales_rep'::app_role)
  THEN
    -- Pode transferir se:
    -- - Ticket atribuído a ele
    -- - Ticket criado por ele
    -- - Ticket sem atribuição
    -- - Ticket no mesmo departamento (NOVO)
    v_is_authorized := (
      v_ticket.assigned_to = v_caller_id 
      OR v_ticket.created_by = v_caller_id 
      OR v_ticket.assigned_to IS NULL
      OR v_ticket.department_id = v_caller_dept
    );
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Sem permissão para transferir este ticket',
      'debug', jsonb_build_object(
        'caller_id', v_caller_id,
        'caller_dept', v_caller_dept,
        'ticket_assigned_to', v_ticket.assigned_to,
        'ticket_created_by', v_ticket.created_by,
        'ticket_department', v_ticket.department_id
      )
    );
  END IF;

  -- 4. Buscar nome do departamento
  SELECT name INTO v_dept_name FROM departments WHERE id = p_department_id;

  -- 5. Buscar nome do assignee se fornecido
  IF p_assigned_to IS NOT NULL THEN
    SELECT full_name INTO v_assignee_name FROM profiles WHERE id = p_assigned_to;
  END IF;

  -- 6. Executar transferência
  UPDATE tickets
  SET 
    department_id = p_department_id,
    assigned_to = p_assigned_to,
    status = CASE 
      WHEN p_assigned_to IS NOT NULL THEN 'in_progress'
      ELSE 'open'
    END,
    updated_at = now()
  WHERE id = p_ticket_id;

  -- 7. Criar comentário interno
  IF p_internal_note IS NOT NULL AND p_internal_note != '' THEN
    INSERT INTO ticket_comments (ticket_id, content, is_internal, created_by)
    VALUES (
      p_ticket_id, 
      format('📤 Ticket transferido para %s%s\n\n%s', 
        COALESCE(v_dept_name, 'Departamento'), 
        CASE WHEN v_assignee_name IS NOT NULL THEN format(' (atribuído para %s)', v_assignee_name) ELSE '' END,
        p_internal_note
      ), 
      true, 
      v_caller_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'department_id', p_department_id,
    'department_name', v_dept_name,
    'assigned_to', p_assigned_to,
    'assignee_name', v_assignee_name
  );
END;
$$;
```

---

## Verificação Pós-Implementação

| Teste | Esperado |
|-------|----------|
| Time comercial (role=user) vê deals atribuídos | SIM |
| Caroline transfere ticket do mesmo departamento | SIM |
| Marco Cruz cria usuário | SIM (já funciona) |

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Atualizar RPC transfer_ticket_secure |

---

## Critérios de Aceite

1. **Deals**: Usuários com role=user veem seus próprios deals
2. **Tickets**: support_agent pode transferir tickets do mesmo departamento
3. **Usuários**: cs_manager pode criar usuários (verificar logs se não funcionar)

