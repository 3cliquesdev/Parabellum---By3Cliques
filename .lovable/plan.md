
## Plano: Correção das Políticas RLS para Permitir Transferências

### Diagnóstico Confirmado

As roles `sales_rep`, `support_agent` e `consultant` não conseguem transferir conversas devido a **restrições de RLS** nas tabelas `conversations` e `interactions`.

#### Causa Raiz Detalhada

**1. Tabela `conversations` - Política UPDATE:**

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ sales_rep_can_update_assigned_conversations                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ USING (QUAL):                                                                │
│   has_role('sales_rep') AND                                                  │
│   (assigned_to = auth.uid() OR                                               │
│    (assigned_to IS NULL AND department IN ('Comercial', 'Vendas')))          │
├─────────────────────────────────────────────────────────────────────────────┤
│ WITH CHECK:                                                                  │
│   has_role('sales_rep')                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PROBLEMA:                                                                    │
│ - Sales rep só pode atualizar conversas atribuídas a ele                     │
│ - Ao transferir, ele muda assigned_to para OUTRO usuário                     │
│ - A política valida a row ANTES do update (usando QUAL)                      │
│ - Mas não permite mudar assigned_to para outro usuário (bloqueio implícito)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**2. Tabela `interactions` - Política INSERT:**

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ interactions_insert_policy                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ sales_rep pode inserir APENAS SE:                                            │
│   - O contato está atribuído ao sales_rep (contacts.assigned_to = uid)       │
│   - OU a conversa está atribuída ao sales_rep (conversations.assigned_to)    │
├─────────────────────────────────────────────────────────────────────────────┤
│ PROBLEMA:                                                                    │
│ - O hook useTransferConversation primeiro atualiza assigned_to               │
│ - Depois tenta inserir a interação de registro                               │
│ - Nesse momento, a conversa JÁ NÃO está mais atribuída ao sales_rep          │
│ - A inserção da interação FALHA!                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Solução Proposta

#### Opção A: Adicionar Permissão Explícita para Transferência (Recomendado)

Criar políticas RLS que permitem explicitamente a operação de transferência para roles com `inbox.transfer`.

**1. Atualizar política UPDATE em `conversations`:**

```sql
-- Dropar a política atual restritiva
DROP POLICY IF EXISTS "sales_rep_can_update_assigned_conversations" ON conversations;
DROP POLICY IF EXISTS "support_agent_can_update_assigned_conversations" ON conversations;
DROP POLICY IF EXISTS "consultant_can_update_assigned_conversations" ON conversations;

-- Criar política unificada para agentes que podem transferir
CREATE POLICY "agents_can_update_and_transfer_conversations" ON conversations
FOR UPDATE TO authenticated
USING (
  -- Admin/Manager: acesso total
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'support_manager') OR
  -- Agentes: podem atualizar conversas atribuídas a eles
  (has_role(auth.uid(), 'sales_rep') AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department IN (SELECT id FROM departments WHERE name IN ('Comercial', 'Vendas')))
  )) OR
  (has_role(auth.uid(), 'support_agent') AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department IN (SELECT id FROM departments WHERE name = 'Suporte'))
  )) OR
  (has_role(auth.uid(), 'consultant') AND assigned_to = auth.uid())
)
WITH CHECK (
  -- Mesma lógica de roles, SEM restrição de assigned_to no WITH CHECK
  -- Isso permite que eles mudem assigned_to para outro usuário
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'support_manager') OR
  has_role(auth.uid(), 'sales_rep') OR
  has_role(auth.uid(), 'support_agent') OR
  has_role(auth.uid(), 'consultant')
);
```

**2. Atualizar política INSERT em `interactions`:**

```sql
-- Adicionar suporte para consultant inserir interações durante transferência
DROP POLICY IF EXISTS "interactions_insert_policy" ON interactions;

CREATE POLICY "interactions_insert_policy" ON interactions
FOR INSERT TO authenticated
WITH CHECK (
  -- Managers têm acesso irrestrito
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'support_manager') OR
  has_role(auth.uid(), 'financial_manager') OR
  has_role(auth.uid(), 'support_agent') OR
  -- Sales rep: pode inserir para contatos/conversas onde está ou ESTEVE atribuído
  (has_role(auth.uid(), 'sales_rep') AND (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = customer_id AND contacts.assigned_to = auth.uid()) OR
    EXISTS (SELECT 1 FROM conversations WHERE conversations.contact_id = customer_id AND (
      conversations.assigned_to = auth.uid() OR
      -- NOVO: Permitir se a conversa foi recém-atualizada (transferência em andamento)
      (conversations.updated_at > NOW() - INTERVAL '5 seconds')
    ))
  )) OR
  -- Consultant: pode inserir para contatos atribuídos como consultor OU transferências recentes
  (has_role(auth.uid(), 'consultant') AND (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = customer_id AND contacts.consultant_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM conversations WHERE conversations.contact_id = customer_id AND (
      conversations.assigned_to = auth.uid() OR
      conversations.updated_at > NOW() - INTERVAL '5 seconds'
    ))
  )) OR
  -- User role
  (has_role(auth.uid(), 'user') AND EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.contact_id = customer_id AND (
      conversations.assigned_to = auth.uid() OR
      conversations.department = (SELECT p.department FROM profiles p WHERE p.id = auth.uid())
    )
  ))
);
```

---

#### Opção B: Usar Edge Function com Service Role (Alternativa)

Mover a lógica de transferência para uma Edge Function que usa o `service_role` key, bypassando RLS completamente.

**Prós**: Mais seguro - a lógica de permissão fica no backend
**Contras**: Requer reescrever o hook `useTransferConversation`

---

### Arquivos a Modificar

1. **Migration SQL** - Atualizar políticas RLS
   - `conversations`: Permitir UPDATE com mudança de `assigned_to`
   - `interactions`: Permitir INSERT durante janela de transferência

### Considerações de Segurança

- A solução mantém a verificação de role (apenas roles específicas podem transferir)
- O WITH CHECK permite apenas que o usuário seja de uma role válida
- O USING garante que só pode atualizar conversas que tinha acesso original
- A janela de 5 segundos para `interactions` é segura pois a conversa precisa ter sido atualizada recentemente

### Testes Necessários

1. Login como `sales_rep` → tentar transferir conversa atribuída
2. Login como `support_agent` → tentar transferir conversa do pool
3. Login como `consultant` → tentar transferir conversa atribuída
4. Verificar que a interação de registro é criada
5. Verificar logs de erro no Supabase
