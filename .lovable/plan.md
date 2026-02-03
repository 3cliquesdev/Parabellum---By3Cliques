

# Plano: Correção de Filtros de Deals e Políticas do Inbox

## Resumo dos Problemas Identificados

### 1. Filtro de Origem "Formulário" nos Deals ✅ JÁ EXISTE
- `DealFilterPopover.tsx` linha 44: `{ value: "formulario", label: "Formulário" }`
- `SourceMultiSelect.tsx` linha 26: `{ value: "formulario", label: "Formulário", Icon: FileText }`
- **Existem 541 deals com `lead_source = 'formulario'` no banco**

O filtro já existe e funciona. Se não está aparecendo, pode ser um problema de cache do navegador.

---

### 2. Busca no Inbox - Gerentes/Admin sem acesso master 🔴 CRÍTICO

**Problema**: As políticas RLS do `inbox_view` estão incompletas para alguns roles de gestão.

**Políticas Atuais**:
| Role | Política | Problema |
|------|----------|----------|
| admin | `admin_manager_full_access_inbox_view` | ✅ OK |
| manager | `admin_manager_full_access_inbox_view` | ✅ OK |
| general_manager | `general_manager_view_inbox` | ✅ OK |
| cs_manager | `cs_manager_view_inbox` | ✅ OK |
| support_manager | `support_manager_view_inbox` | ✅ OK |
| financial_manager | ❌ FALTA | 🔴 Não vê nada |
| financial_agent | ❌ FALTA | 🔴 Não vê nada |

**Solução**: Adicionar políticas RLS para `financial_manager` e `financial_agent`.

---

### 3. Agentes de Departamento não encontram suas conversas 🔴 CRÍTICO

**Problema**: As políticas de `sales_rep` e `support_agent` têm a condição `status = 'open'` para conversas não atribuídas, mas **também excluem conversas atribuídas a eles que estão fechadas** (histórico).

**Política Atual de `sales_rep`**:
```sql
has_role(auth.uid(), 'sales_rep') AND (
  assigned_to = auth.uid() 
  OR 
  (status = 'open' AND assigned_to IS NULL AND department IN (Comercial/Vendas))
)
```

A política parece correta (`assigned_to = auth.uid()` deveria incluir fechadas), mas precisa de verificação.

**Política Atual de `support_agent`**:
```sql
has_role(auth.uid(), 'support_agent') AND (
  assigned_to = auth.uid() 
  OR 
  (status = 'open' AND assigned_to IS NULL AND department = Suporte)
)
```

---

### 4. Deals de Formulários indo para Pipeline correta ✅ CONFIRMADO

**Dados do banco**:
| Pipeline | Deals de Formulário |
|----------|---------------------|
| Vendas - Nacional | 478 |
| Vendas - Internacional | 37 |
| Vendas - Híbrido | 23 |
| Recuperação - Nacional | 3 |

Os formulários estão direcionando corretamente para pipelines de Vendas.

---

## Correções Necessárias

### Migration SQL: Políticas do inbox_view

```sql
-- 1. Adicionar política para financial_manager (acesso total)
CREATE POLICY financial_manager_view_inbox
ON public.inbox_view
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'financial_manager'::app_role));

-- 2. Adicionar política para financial_agent (seu departamento)
CREATE POLICY financial_agent_view_inbox
ON public.inbox_view
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'financial_agent'::app_role) AND (
    assigned_to = auth.uid() 
    OR (
      status = 'open' 
      AND assigned_to IS NULL 
      AND department IN (
        SELECT id FROM departments 
        WHERE name IN ('Financeiro', 'Finance', 'Financial')
      )
    )
  )
);
```

### Migration SQL: Políticas de conversations (consistência)

```sql
-- 1. Adicionar política para financial_manager (SELECT)
CREATE POLICY financial_manager_can_view_all_conversations
ON public.conversations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'financial_manager'::app_role));

-- 2. Adicionar política para financial_manager (UPDATE)
CREATE POLICY financial_manager_can_update_conversations
ON public.conversations
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'financial_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'financial_manager'::app_role));

-- 3. Adicionar política para financial_agent (SELECT)
CREATE POLICY financial_agent_can_view_assigned_conversations
ON public.conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'financial_agent'::app_role) AND (
    assigned_to = auth.uid() 
    OR (
      status = 'open' 
      AND assigned_to IS NULL 
      AND department IN (
        SELECT id FROM departments 
        WHERE name IN ('Financeiro', 'Finance', 'Financial')
      )
    )
  )
);
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Nova migration SQL | Adicionar políticas RLS para financial_manager e financial_agent |

---

## Resultado Esperado

1. **Gerentes/Admin**: Acesso total ao Inbox (busca retorna TODAS as conversas)
2. **Financial Manager**: Vê todas as conversas do sistema
3. **Financial Agent**: Vê conversas atribuídas a ele + não atribuídas do departamento Financeiro
4. **Histórico de Agentes**: Agentes continuam vendo suas conversas fechadas (já funciona com `assigned_to = auth.uid()`)
5. **Formulários**: Já estão funcionando corretamente

---

## Seção Técnica

### Verificação do Frontend (useDepartmentsByRole.tsx)

O hook `useDepartmentsByRole` já contempla `financial_agent`:
```typescript
case "financial_agent":
case "financial_manager":
  return departments
    .filter((d) =>
      ["Financeiro", "Finance", "Financial"].some(
        (name) => d.name.toLowerCase() === name.toLowerCase()
      )
    )
    .map((d) => d.id);
```

Porém o `hasFullInboxAccess` não inclui `financial_manager`:
```typescript
export const FULL_ACCESS_ROLES = [
  "admin",
  "manager",
  "general_manager",
  "support_manager",
  "cs_manager",
] as const; // ← falta financial_manager
```

### Ajuste Adicional: src/config/roles.ts

```typescript
export const FULL_ACCESS_ROLES = [
  "admin",
  "manager",
  "general_manager",
  "support_manager",
  "cs_manager",
  "financial_manager", // ← ADICIONAR
] as const;
```

Isso garante que `financial_manager` não tenha filtros de departamento aplicados no frontend.

