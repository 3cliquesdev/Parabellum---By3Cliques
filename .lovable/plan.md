
# Plano: PATCH DEFINITIVO - Fim dos Problemas de Permissão

## Diagnóstico Confirmado

| Usuário | Problema | Causa Raiz |
|---------|----------|------------|
| Marco Cruz (cs_manager) | Não consegue criar usuários | `users.manage = FALSE` na tabela `role_permissions` |
| Loriani Vitoria (sales_rep) | Erro ao transferir conversas | `useTakeControl` faz UPDATE direto com `assigned_to = user.id` - a política WITH CHECK do sales_rep valida que após update `assigned_to` ainda seja dele (impossível quando assume conversa de outro) |
| Caroline Lamonica (support_agent) | Erro ao transferir tickets | `useTicketTransfer` faz UPDATE direto - a política WITH CHECK exige `assigned_to = auth.uid()` após update (impossível quando transfere para outro agente) |

---

## Correções a Aplicar

### Correção 1: Habilitar `users.manage` para CS Manager

**Tipo**: Atualização de dados (role_permissions)

```sql
UPDATE role_permissions
SET enabled = true, updated_at = now()
WHERE role = 'cs_manager' AND permission_key = 'users.manage';
```

---

### Correção 2: Criar RPC `transfer_ticket_secure` (SECURITY DEFINER)

**Tipo**: Migration SQL

Esta RPC bypassa RLS com validação explícita, seguindo o mesmo padrão do `transfer_conversation_secure`.

```sql
CREATE OR REPLACE FUNCTION public.transfer_ticket_secure(
  p_ticket_id UUID,
  p_department_id UUID,
  p_assigned_to UUID DEFAULT NULL,
  p_internal_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_ticket RECORD;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- 1. Buscar ticket
  SELECT id, assigned_to, created_by, department_id
  INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket não encontrado');
  END IF;

  -- 2. Verificar autorização:
  -- - admin/manager/general_manager/cs_manager/support_manager/financial_manager: pode tudo
  -- - support_agent: só se ticket atribuído a ele, criado por ele, ou unassigned
  IF has_role(v_caller_id, 'admin') 
     OR has_role(v_caller_id, 'manager')
     OR has_role(v_caller_id, 'general_manager')
     OR has_role(v_caller_id, 'cs_manager')
     OR has_role(v_caller_id, 'support_manager')
     OR has_role(v_caller_id, 'financial_manager')
  THEN
    v_is_authorized := true;
  ELSIF has_role(v_caller_id, 'support_agent') 
        OR has_role(v_caller_id, 'financial_agent')
        OR has_role(v_caller_id, 'ecommerce_analyst')
  THEN
    v_is_authorized := (
      v_ticket.assigned_to = v_caller_id 
      OR v_ticket.created_by = v_caller_id 
      OR v_ticket.assigned_to IS NULL
    );
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para transferir este ticket');
  END IF;

  -- 3. Executar transferência
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

  -- 4. Criar comentário interno se nota fornecida
  IF p_internal_note IS NOT NULL AND p_internal_note != '' THEN
    INSERT INTO ticket_comments (ticket_id, content, is_internal, created_by)
    VALUES (p_ticket_id, p_internal_note, true, v_caller_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'department_id', p_department_id,
    'assigned_to', p_assigned_to
  );
END;
$$;

-- Revogar acesso público e conceder apenas para authenticated
REVOKE ALL ON FUNCTION public.transfer_ticket_secure(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_ticket_secure(UUID, UUID, UUID, TEXT) TO authenticated;
```

---

### Correção 3: Criar RPC `take_control_secure` (SECURITY DEFINER)

**Tipo**: Migration SQL

Para o useTakeControl, criar RPC que valida e executa a tomada de controle:

```sql
CREATE OR REPLACE FUNCTION public.take_control_secure(
  p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_conversation RECORD;
  v_profile RECORD;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- 1. Buscar conversa
  SELECT c.*, d.name as dept_name
  INTO v_conversation
  FROM conversations c
  LEFT JOIN departments d ON d.id = c.department
  WHERE c.id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- 2. Buscar perfil do usuário
  SELECT id, full_name, availability_status
  INTO v_profile
  FROM profiles
  WHERE id = v_caller_id;

  -- 3. Verificar se é manager/admin (não precisa estar online)
  IF has_role(v_caller_id, 'admin') 
     OR has_role(v_caller_id, 'manager')
     OR has_role(v_caller_id, 'general_manager')
     OR has_role(v_caller_id, 'cs_manager')
     OR has_role(v_caller_id, 'support_manager')
     OR has_role(v_caller_id, 'financial_manager')
  THEN
    v_is_authorized := true;
  ELSE
    -- Agentes precisam estar online
    IF v_profile.availability_status != 'online' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Altere seu status para Online para assumir conversas');
    END IF;
    
    -- Conversa não atribuída (IA) pode ser assumida por qualquer agente
    IF v_conversation.assigned_to IS NULL THEN
      v_is_authorized := true;
    -- Conversa atribuída ao próprio usuário
    ELSIF v_conversation.assigned_to = v_caller_id THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para assumir esta conversa');
  END IF;

  -- 4. Executar takeover
  UPDATE conversations
  SET 
    ai_mode = 'copilot',
    assigned_to = v_caller_id
  WHERE id = p_conversation_id;

  -- 5. Inserir mensagem de sistema
  INSERT INTO messages (conversation_id, content, sender_type, sender_id, is_ai_generated)
  VALUES (
    p_conversation_id,
    format('O atendente **%s** entrou na conversa.', COALESCE(v_profile.full_name, 'Suporte')),
    'system',
    v_caller_id,
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'assigned_to', v_caller_id,
    'ai_mode', 'copilot'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.take_control_secure(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_control_secure(UUID) TO authenticated;
```

---

### Correção 4: Atualizar Hooks do Frontend

**Arquivos a modificar:**

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useTicketTransfer.tsx` | Substituir `supabase.from('tickets').update()` por `supabase.rpc('transfer_ticket_secure')` |
| `src/hooks/useBulkTransferTickets.tsx` | Usar loop de `supabase.rpc('transfer_ticket_secure')` para cada ticket |
| `src/hooks/useTakeControl.tsx` | Substituir `supabase.from('conversations').update()` por `supabase.rpc('take_control_secure')` |

**Exemplo - useTicketTransfer.tsx:**

```typescript
// ANTES (UPDATE direto - falha no RLS)
const { data, error } = await supabase
  .from("tickets")
  .update({
    department_id,
    status: newStatus,
    assigned_to: assigned_to ?? null,
  })
  .eq("id", ticket_id)
  .select()
  .single();

// DEPOIS (RPC SECURITY DEFINER - bypassa RLS com validação)
const { data: result, error } = await supabase
  .rpc('transfer_ticket_secure', {
    p_ticket_id: ticket_id,
    p_department_id: department_id,
    p_assigned_to: assigned_to ?? null,
    p_internal_note: internal_note
  });

if (!result?.success) {
  throw new Error(result?.error || 'Erro ao transferir ticket');
}
```

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | 1. Habilitar users.manage para cs_manager |
| Migration SQL | 2. Criar transfer_ticket_secure RPC |
| Migration SQL | 3. Criar take_control_secure RPC |
| `src/hooks/useTicketTransfer.tsx` | Usar RPC ao invés de UPDATE direto |
| `src/hooks/useBulkTransferTickets.tsx` | Usar RPC ao invés de UPDATE direto |
| `src/hooks/useTakeControl.tsx` | Usar RPC ao invés de UPDATE direto |

---

## Por que esta solução é definitiva?

1. **Zero UPDATE direto em campos sensíveis** - Todas as operações de transferência/atribuição passam por RPC

2. **Validação centralizada na RPC** - Regras de negócio ficam no banco, não espalhadas pelo frontend

3. **SECURITY DEFINER bypassa RLS** - A função executa com privilégios do owner, não do caller

4. **Auditoria mantida** - RPCs ainda criam logs/comentários internos

5. **Padrão consistente** - Mesma arquitetura do `transfer_conversation_secure` que já funciona

---

## Checklist de Validação Pós-Deploy

- [ ] Marco Cruz (cs_manager) consegue criar usuários
- [ ] Loriani (sales_rep) consegue assumir conversas da IA
- [ ] Caroline (support_agent) consegue transferir tickets para outros agentes
- [ ] Buscar no código: `from('tickets').update({ assigned_to` → 0 resultados
- [ ] Buscar no código: `from('conversations').update({ assigned_to` → 0 resultados (exceto RPC)
