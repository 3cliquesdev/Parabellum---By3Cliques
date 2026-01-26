
## Plano: Corrigir Transferência de Conversas pelos Atendentes

### Diagnóstico Completo

O problema foi identificado com precisão:

| Camada | Status | Problema |
|--------|--------|----------|
| Interface (UI) | Funciona | Botão "Transferir" aparece para `support_agent` |
| Permissão Aplicação | Funciona | `inbox.transfer = true` para `support_agent` |
| Banco de Dados (RLS) | BLOQUEADO | Política só permite UPDATE se `assigned_to = auth.uid()` |

**Causa Raiz**: A política RLS `agents_can_update_and_transfer_conversations` foi criada para proteger conversas, mas acabou **bloqueando transferências legítimas**.

Um `support_agent` só pode atualizar conversas se:
- A conversa está atribuída **a ele mesmo** (`assigned_to = auth.uid()`)
- OU a conversa está **sem atribuição** (`assigned_to IS NULL`) e pertence ao departamento Suporte

**Resultado**: Se Miguel (support_agent) tenta transferir uma conversa que está atribuída a ele, funciona. Mas se tentar transferir conversa do pool ou de outro agente, falha silenciosamente.

---

### Solução Proposta

Criar uma **função SECURITY DEFINER** no banco que bypassa o RLS para transferências autorizadas. A função validará:
1. Se o usuário tem permissão `inbox.transfer` habilitada
2. Se o usuário pode visualizar a conversa (via SELECT policy)
3. Registra a transferência com auditoria completa

Esta abordagem é **segura** porque:
- A função verifica permissões antes de executar
- Mantém RLS intacta para operações normais
- Registra quem transferiu para quem (auditoria)
- Só roles específicos podem chamar a função

---

### Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migration SQL | Criar | Função `transfer_conversation_secure` com SECURITY DEFINER |
| `src/hooks/useTransferConversation.tsx` | Modificar | Usar `supabase.rpc()` ao invés de `.update()` direto |

---

### 1. Nova Função de Banco de Dados

```sql
CREATE OR REPLACE FUNCTION public.transfer_conversation_secure(
  p_conversation_id UUID,
  p_to_user_id UUID,
  p_to_department_id UUID,
  p_transfer_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_has_permission BOOLEAN;
  v_can_view BOOLEAN;
  v_conversation RECORD;
  v_from_user_name TEXT;
  v_to_user_name TEXT;
  v_department_name TEXT;
BEGIN
  -- 1. Verificar se o usuário tem permissão inbox.transfer
  SELECT EXISTS(
    SELECT 1 FROM role_permissions rp
    JOIN user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = v_caller_id
      AND rp.permission_key = 'inbox.transfer'
      AND rp.enabled = true
  ) OR has_role(v_caller_id, 'admin')
  INTO v_has_permission;

  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para transferir conversas');
  END IF;

  -- 2. Verificar se a conversa existe e buscar dados atuais
  SELECT c.*, ct.first_name, ct.last_name
  INTO v_conversation
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.id = p_conversation_id;

  IF v_conversation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- 3. Buscar nomes para auditoria
  SELECT full_name INTO v_from_user_name 
  FROM profiles WHERE id = v_conversation.assigned_to;
  
  SELECT full_name INTO v_to_user_name 
  FROM profiles WHERE id = p_to_user_id;
  
  SELECT name INTO v_department_name 
  FROM departments WHERE id = p_to_department_id;

  -- 4. Executar transferência (bypassa RLS por ser SECURITY DEFINER)
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department = p_to_department_id,
    previous_agent_id = v_conversation.assigned_to
  WHERE id = p_conversation_id;

  -- 5. Registrar interação de auditoria
  INSERT INTO interactions (
    customer_id,
    type,
    content,
    channel,
    metadata
  ) VALUES (
    v_conversation.contact_id,
    'conversation_transferred',
    format('Conversa transferida de %s para %s (%s)',
      COALESCE(v_from_user_name, 'Pool'),
      COALESCE(v_to_user_name, 'Pool do Departamento'),
      v_department_name
    ),
    'other',
    jsonb_build_object(
      'from_user_id', v_conversation.assigned_to,
      'to_user_id', p_to_user_id,
      'from_user_name', v_from_user_name,
      'to_user_name', v_to_user_name,
      'to_department_id', p_to_department_id,
      'to_department_name', v_department_name,
      'conversation_id', p_conversation_id,
      'transfer_note', p_transfer_note,
      'transferred_by', v_caller_id,
      'is_internal', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'to_user_id', p_to_user_id,
    'to_department_id', p_to_department_id
  );
END;
$$;
```

---

### 2. Atualizar Hook de Transferência

Modificar `useTransferConversation.tsx` para usar a função RPC:

```typescript
// ANTES (linha 61-67):
const { error: updateError } = await supabase
  .from("conversations")
  .update({ 
    assigned_to: finalToUserId,
    department: departmentId,
  })
  .eq("id", conversationId);

// DEPOIS:
const { data: result, error: rpcError } = await supabase
  .rpc('transfer_conversation_secure', {
    p_conversation_id: conversationId,
    p_to_user_id: finalToUserId,
    p_to_department_id: departmentId,
    p_transfer_note: transferNote,
  });

if (rpcError) throw rpcError;
if (!result?.success) throw new Error(result?.error || 'Erro ao transferir');
```

---

### Secao Tecnica: Fluxo de Seguranca

```text
Atendente clica "Transferir"
         |
         v
[Frontend] Chama supabase.rpc('transfer_conversation_secure')
         |
         v
[Função SECURITY DEFINER] - Executa como owner, não como caller
         |
         +---> Verifica inbox.transfer na role_permissions
         |         |
         |     NAO OK --> Retorna erro "Sem permissão"
         |
         +---> OK --> Executa UPDATE bypassing RLS
         |
         +---> Registra auditoria em interactions
         |
         v
[Retorno] {success: true, conversation_id, to_user_id}
```

---

### Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Atendente transfere conversa dele | Funciona | Funciona |
| Atendente transfere conversa do pool | ERRO | Funciona |
| Atendente transfere para pessoa específica | ERRO | Funciona |
| Atendente sem permissão tenta transferir | N/A | Bloqueado pela função |
| Auditoria de quem transferiu | Parcial | Completa |

---

### Benefícios

1. **Zero alteração na UI** - Mesmo dialog, mesma experiência
2. **Segurança mantida** - RLS continua protegendo operações normais
3. **Auditoria completa** - Registra quem transferiu, de onde, para onde
4. **Flexibilidade** - Qualquer role com `inbox.transfer` pode transferir
5. **Sem race conditions** - Operação atômica dentro da função

---

### Testes a Realizar

1. Miguel (support_agent) transfere conversa dele para Suporte
2. Miguel transfere conversa do pool para Comercial
3. Miguel transfere para pessoa específica (João)
4. Usuário sem permissão tenta transferir (deve falhar)
5. Verificar registro de auditoria em interactions
