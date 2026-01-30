

# Plano: Corrigir Transferências e Proteção de AI Mode no Comercial

## Diagnóstico Completo

Após investigação profunda, identifiquei dois problemas que afetam o time Comercial:

### Problema 1: "Sem permissão para transferir"

A função `transfer_conversation_secure` está falhando ao tentar atualizar `ai_mode` porque:
- A coluna `ai_mode` é um **ENUM** (tipo customizado)
- A função atribui strings diretamente: `ai_mode = 'copilot'`
- O PostgreSQL requer cast explícito: `ai_mode = 'copilot'::ai_mode`

O erro que aparece nos logs do Postgres confirma:
```
ERROR: column "ai_mode" is of type ai_mode but expression is of type text
```

### Problema 2: IA Respondendo em Conversas com Agente Atribuído

Algumas conversas podem estar com `ai_mode = 'autopilot'` mesmo tendo agente atribuído. Isso acontece quando:
1. O UPDATE de `ai_mode` falha silenciosamente devido ao erro de ENUM
2. A conversa foi transferida antes do fix de handoff

### Evidência dos Logs

| Timestamp | Erro |
|-----------|------|
| 14:27:46 | `column "ai_mode" is of type ai_mode but expression is of type text` |

### Estado Atual do Comercial

| Conversa | ai_mode | assigned_to | Status |
|----------|---------|-------------|--------|
| Maioria | `copilot` | Fernanda/Thaynara | OK |
| Algumas | `waiting_human` | Fernanda/Thaynara | OK |
| Potenciais órfãs | `autopilot`? | Atribuído | PROBLEMA |

## Solução

### Correção 1: Cast Explícito para ENUM na Função SQL

Modificar a função `transfer_conversation_secure` para usar cast explícito:

```sql
-- ANTES (causa erro):
ai_mode = CASE 
  WHEN p_to_user_id IS NOT NULL THEN 'copilot'
  ELSE 'waiting_human'
END

-- DEPOIS (correto):
ai_mode = CASE 
  WHEN p_to_user_id IS NOT NULL THEN 'copilot'::ai_mode
  ELSE 'waiting_human'::ai_mode
END
```

### Correção 2: Cast Explícito no Webhook

O `meta-whatsapp-webhook` também precisa ajustar os updates para usar o cast correto. Verificar todas as ocorrências de `ai_mode` no código TypeScript das Edge Functions.

### Correção 3: Reparar Conversas Órfãs

Executar SQL para corrigir conversas que têm agente atribuído mas estão em `autopilot`:

```sql
UPDATE conversations
SET ai_mode = 'copilot'
WHERE assigned_to IS NOT NULL
  AND ai_mode = 'autopilot'
  AND status = 'open';
```

## Mudanças Necessárias

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| Migration SQL | Banco de Dados | Recriar função com cast explícito |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Edge Function | Verificar se SDK do Supabase aceita string |
| Migration SQL | Banco de Dados | Corrigir conversas órfãs |

## Impacto Esperado

### Antes (Bug)

| Cenário | Resultado |
|---------|-----------|
| Agente do Comercial tenta transferir | "Sem permissão" (UPDATE falha) |
| IA em conversa com agente | Responde automaticamente |

### Depois (Corrigido)

| Cenário | Resultado |
|---------|-----------|
| Agente do Comercial tenta transferir | Sucesso, ai_mode = copilot |
| IA em conversa com agente | Bloqueada (ai_mode = copilot) |

## Compatibilidade

- Não afeta fluxo de transferência existente
- Corrige edge cases de ENUM
- Mantém todas as proteções de ai_mode

---

## Seção Técnica

### SQL da Função Corrigida

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
  v_conversation RECORD;
  v_from_user_name TEXT;
  v_to_user_name TEXT;
  v_department_name TEXT;
  v_new_ai_mode ai_mode;  -- Usar tipo ENUM explícito
BEGIN
  -- 1. Verificar permissão
  SELECT EXISTS(
    SELECT 1 FROM role_permissions rp
    JOIN user_roles ur ON ur.role::text = rp.role::text
    WHERE ur.user_id = v_caller_id
      AND rp.permission_key = 'inbox.transfer'
      AND rp.enabled = true
  ) OR public.has_role(v_caller_id, 'admin')
  INTO v_has_permission;

  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para transferir conversas');
  END IF;

  -- 2. Buscar conversa
  SELECT c.*, ct.first_name, ct.last_name
  INTO v_conversation
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.id = p_conversation_id;

  IF v_conversation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- 3. Buscar nomes
  SELECT full_name INTO v_from_user_name FROM profiles WHERE id = v_conversation.assigned_to;
  SELECT full_name INTO v_to_user_name FROM profiles WHERE id = p_to_user_id;
  SELECT name INTO v_department_name FROM departments WHERE id = p_to_department_id;

  -- 4. Determinar novo ai_mode com cast explícito
  v_new_ai_mode := CASE 
    WHEN p_to_user_id IS NOT NULL THEN 'copilot'::ai_mode
    ELSE 'waiting_human'::ai_mode
  END;

  -- 5. Executar transferência
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department = p_to_department_id,
    previous_agent_id = v_conversation.assigned_to,
    ai_mode = v_new_ai_mode  -- Usar variável tipada
  WHERE id = p_conversation_id;

  -- 6. Registrar auditoria
  INSERT INTO interactions (customer_id, type, content, channel, metadata)
  VALUES (
    v_conversation.contact_id,
    'conversation_transferred',
    format('🔄 Conversa transferida de %s para %s (%s)',
      COALESCE(v_from_user_name, 'Pool'),
      COALESCE(v_to_user_name, 'Pool do Departamento'),
      COALESCE(v_department_name, 'Departamento')
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
      'is_internal', true,
      'ai_mode_set_to', v_new_ai_mode::text
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'to_user_id', p_to_user_id,
    'to_department_id', p_to_department_id,
    'ai_mode', v_new_ai_mode::text
  );
END;
$$;
```

### SQL para Corrigir Conversas Órfãs

```sql
-- Corrigir conversas com agente mas em autopilot
UPDATE conversations
SET ai_mode = 'copilot'::ai_mode
WHERE assigned_to IS NOT NULL
  AND ai_mode = 'autopilot'
  AND status = 'open';

-- Corrigir conversas do Comercial específicas
UPDATE conversations
SET ai_mode = 'waiting_human'::ai_mode
WHERE department = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c'
  AND ai_mode = 'autopilot'
  AND status = 'open'
  AND assigned_to IS NULL;
```

### Verificação Pós-Deploy

1. Agente do Comercial tenta transferir uma conversa
2. Verificar que o toast mostra "Conversa transferida com sucesso"
3. Verificar no banco: `ai_mode = 'copilot'` ou `'waiting_human'`
4. Cliente envia mensagem → Verificar que IA NÃO responde

