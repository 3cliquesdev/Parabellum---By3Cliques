
## Plano: Corrigir Acesso de Gerentes aos Fluxos de Chat

### Problema Raiz

A política RLS da tabela `chat_flows` foi criada com apenas 2 roles:
- `admin`
- `manager`

Mas a permissão `settings.chat_flows` no frontend está habilitada para:
- `admin` ✅
- `manager` ✅
- `general_manager` ✅
- `support_manager` ✅

**Resultado:** O Danilo Pereira (role: `support_manager`) passa pelo frontend mas é bloqueado pelo banco de dados.

---

### Solução

Atualizar a política RLS da tabela `chat_flows` para incluir todos os roles que têm a permissão habilitada.

---

### Migração SQL a Executar

```sql
-- Remover política antiga restritiva
DROP POLICY IF EXISTS "Admins and managers can manage chat flows" ON public.chat_flows;

-- Criar nova política incluindo todos os roles de gerência
CREATE POLICY "Admins and managers can manage chat flows"
ON public.chat_flows
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'general_manager', 'support_manager')
  )
);
```

---

### Roles Afetados

| Role | Antes | Depois |
|------|-------|--------|
| admin | ✅ | ✅ |
| manager | ✅ | ✅ |
| general_manager | ❌ | ✅ |
| support_manager | ❌ | ✅ |

---

### Impacto

- **Danilo Pereira** (support_manager) poderá ver e editar fluxos de chat
- Outros gerentes com `general_manager` também terão acesso
- Nenhuma alteração no frontend necessária

---

### Seção Técnica

**Tabela afetada:** `public.chat_flows`

**Política atual (linha 43-52 da migração original):**
```sql
role IN ('admin', 'manager')
```

**Nova política:**
```sql
role IN ('admin', 'manager', 'general_manager', 'support_manager')
```

**Usuário específico:**
- ID: `2bca2fa4-862d-4ed2-bc60-0aff386c50bd`
- Email: `danilo.pereira@3cliques.net`
- Role: `support_manager`

