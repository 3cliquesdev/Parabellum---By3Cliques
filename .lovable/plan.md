
# Plano: Corrigir Erro "updated_at column does not exist" em take_control_secure

## Diagnóstico

### Problema Reportado
Admin Pamela recebe o erro: **"column 'updated_at' of relation 'conversations' does not exist"** ao clicar em "Assumir" conversa.

### Causa Raiz
A RPC `take_control_secure` contém uma linha incorreta:

```sql
UPDATE conversations
SET 
  ai_mode = 'copilot',
  assigned_to = v_caller_id,
  updated_at = now()  -- ❌ ESTA COLUNA NÃO EXISTE!
WHERE id = p_conversation_id;
```

### Evidência
- Tabela `conversations` **não possui** coluna `updated_at`
- Tabela `conversations` usa `last_message_at` para rastrear atividade
- Tabela `inbox_view` (separada) possui `updated_at` e é atualizada por triggers

---

## Solução

Criar migration SQL para recriar a função `take_control_secure` **removendo** a referência à coluna inexistente.

### Código Corrigido

```sql
CREATE OR REPLACE FUNCTION public.take_control_secure(p_conversation_id UUID)
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
  IF has_role(v_caller_id, 'admin'::app_role) 
     OR has_role(v_caller_id, 'manager'::app_role)
     OR has_role(v_caller_id, 'general_manager'::app_role)
     OR has_role(v_caller_id, 'cs_manager'::app_role)
     OR has_role(v_caller_id, 'support_manager'::app_role)
     OR has_role(v_caller_id, 'financial_manager'::app_role)
  THEN
    v_is_authorized := true;
  ELSE
    -- Agentes precisam estar online
    IF v_profile.availability_status != 'online' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Altere seu status para Online');
    END IF;
    
    -- Conversa não atribuída pode ser assumida por qualquer agente
    IF v_conversation.assigned_to IS NULL THEN
      v_is_authorized := true;
    -- Conversa atribuída ao próprio usuário
    ELSIF v_conversation.assigned_to = v_caller_id THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  -- 4. Executar takeover (SEM updated_at)
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
```

---

## Arquivos a Modificar

### 1. Nova Migration SQL (via Supabase migration tool)

A função será recriada com `CREATE OR REPLACE FUNCTION`, mantendo todas as permissões.

---

## Impacto

| Antes | Depois |
|-------|--------|
| Erro ao assumir qualquer conversa | Assumir funciona normalmente |
| Admin/Manager bloqueado | Pode assumir sem restrições |
| Agentes bloqueados | Podem assumir se online |

---

## Seção Técnica

### Por que não adicionar updated_at na tabela conversations?

1. **Padrão existente:** O sistema usa `last_message_at` para rastrear atividade
2. **Triggers funcionando:** `inbox_view` já sincroniza via triggers e tem seu próprio `updated_at`
3. **Menor risco:** Alterar estrutura de tabela pode quebrar outras queries

### Validação Pós-Deploy

1. Login como admin (Pamela)
2. Ir para Inbox
3. Selecionar conversa em "Não atribuídas" ou "Fila IA"
4. Clicar em "Assumir"
5. Verificar: ai_mode muda para copilot, composer habilitado, sem erro
