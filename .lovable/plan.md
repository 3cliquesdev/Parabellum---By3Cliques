
# Plano: PATCH 1-SHOT - Seguranca + Auditoria + Debug

## Resumo Executivo

Este patch resolve 3 problemas criticos em uma unica entrega:

1. **Brecha de Seguranca**: role `user` tem `inbox.transfer = TRUE` (precisa ser FALSE)
2. **Auditoria Executavel**: Pagina `/admin/permissions-audit` com RPCs agregadas
3. **Debug Estruturado**: Logs detalhados para rastrear erros de permissao

---

## 1) MIGRATION SQL - Fechar Brechas e Criar RPCs

### SQL Completo (Migration Unica)

```sql
BEGIN;

-- =============================================
-- PARTE 1: FECHAR BRECHAS DE SEGURANCA
-- =============================================

-- 1) role 'user' nunca pode transferir conversa/ticket ou gerenciar usuarios
UPDATE public.role_permissions
SET enabled = false, updated_at = now()
WHERE role = 'user'
  AND permission_key IN ('inbox.transfer', 'tickets.assign', 'users.manage');

-- 2) Corrigir GRANT perigoso em transfer_conversation_secure (todas as overloads)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'transfer_conversation_secure'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', r.proc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', r.proc);
  END LOOP;
END$$;

-- =============================================
-- PARTE 2: RPCs DE AUDITORIA (EVITAR N+1)
-- =============================================

-- RPC A: Busca usuarios com roles agregadas
CREATE OR REPLACE FUNCTION public.audit_search_users(
  p_search_term TEXT DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  roles TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.full_name,
    u.email,
    COALESCE(ARRAY_AGG(ur.role::TEXT ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE 
    p_search_term IS NULL
    OR p.full_name ILIKE '%' || p_search_term || '%'
    OR u.email ILIKE '%' || p_search_term || '%'
    OR p.id::TEXT = p_search_term
  GROUP BY p.id, p.full_name, u.email
  ORDER BY p.full_name NULLS LAST
  LIMIT 50;
END;
$$;

-- RPC B: Permissoes efetivas de um usuario
CREATE OR REPLACE FUNCTION public.audit_user_effective_permissions(
  p_user_id UUID
)
RETURNS TABLE(
  permission_key TEXT,
  allowed BOOLEAN,
  granted_by_roles TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.permission_key::TEXT,
    BOOL_OR(rp.enabled) AS allowed,
    ARRAY_AGG(DISTINCT rp.role::TEXT) FILTER (WHERE rp.enabled) AS granted_by_roles
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role::TEXT = ur.role::TEXT
  WHERE ur.user_id = p_user_id
  GROUP BY rp.permission_key
  ORDER BY rp.permission_key;
END;
$$;

-- RPC C: Security checks (RLS + Security Definer + Grants)
CREATE OR REPLACE FUNCTION public.audit_security_checks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables JSONB;
  v_rpcs JSONB;
BEGIN
  -- Verificar RLS nas tabelas criticas
  SELECT jsonb_agg(jsonb_build_object(
    'table_name', c.relname,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity
  ))
  INTO v_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('tickets', 'conversations', 'contacts', 'profiles', 'user_roles', 'role_permissions');

  -- Verificar RPCs criticas
  SELECT jsonb_agg(jsonb_build_object(
    'function_name', p.proname,
    'security_definer', p.prosecdef,
    'owner', pg_get_userbyid(p.proowner),
    'signature', p.oid::regprocedure::TEXT
  ))
  INTO v_rpcs
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('transfer_ticket_secure', 'transfer_conversation_secure', 'take_control_secure');

  RETURN jsonb_build_object(
    'tables', COALESCE(v_tables, '[]'::jsonb),
    'rpcs', COALESCE(v_rpcs, '[]'::jsonb),
    'checked_at', now()
  );
END;
$$;

-- Conceder permissoes para as RPCs de auditoria (apenas authenticated)
GRANT EXECUTE ON FUNCTION public.audit_search_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_user_effective_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_security_checks() TO authenticated;

COMMIT;
```

---

## 2) PAGINA /admin/permissions-audit

### Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/PermissionsAudit.tsx` | Pagina principal de auditoria |
| `src/hooks/usePermissionsAudit.tsx` | Hook para RPCs de auditoria |

### Adicionar Rota ao App.tsx

Inserir antes da rota catch-all (linha 270):

```typescript
const PermissionsAudit = lazy(() => import("./pages/PermissionsAudit"));

// Na secao de rotas (antes de /* Catch-all route */)
<Route 
  path="/admin/permissions-audit" 
  element={
    <ProtectedRoute requiredPermission="users.manage">
      <Layout><PermissionsAudit /></Layout>
    </ProtectedRoute>
  } 
/>
```

### Funcionalidades da Pagina

```text
+------------------------------------------------------+
|  Auditoria de Permissoes                             |
+------------------------------------------------------+
|                                                      |
|  [Buscar usuario: _______________] [Buscar]          |
|                                                      |
|  +-- Card: Usuario Selecionado --+                   |
|  | Nome: Marco Cruz                                  |
|  | Email: marco.cruz@3cliques.net                    |
|  | Roles: [cs_manager]                               |
|  +----------------------------------------------+    |
|                                                      |
|  +-- Card: Permissoes Efetivas --+                   |
|  | users.manage    [TRUE]  via: cs_manager           |
|  | inbox.transfer  [TRUE]  via: cs_manager           |
|  | tickets.assign  [TRUE]  via: cs_manager           |
|  +----------------------------------------------+    |
|                                                      |
|  +-- Card: Security Checks --+                       |
|  | Tabelas Criticas:                                 |
|  | - tickets: RLS=ON, Force=OFF                      |
|  | - conversations: RLS=ON, Force=OFF                |
|  |                                                   |
|  | RPCs SECURITY DEFINER:                            |
|  | - transfer_ticket_secure: owner=postgres [OK]     |
|  | - transfer_conversation_secure: owner=postgres    |
|  | - take_control_secure: owner=postgres [OK]        |
|  +----------------------------------------------+    |
|                                                      |
|  [Export Users CSV] [Export Permissions CSV]         |
+------------------------------------------------------+
```

### Hook usePermissionsAudit.tsx (Estrutura)

```typescript
import { supabase } from "@/integrations/supabase/client";

export interface AuditUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
  roles: string[];
}

export interface EffectivePermission {
  permission_key: string;
  allowed: boolean;
  granted_by_roles: string[] | null;
}

export interface SecurityChecks {
  tables: { table_name: string; rls_enabled: boolean; rls_forced: boolean }[];
  rpcs: { function_name: string; security_definer: boolean; owner: string; signature: string }[];
  checked_at: string;
}

export const usePermissionsAudit = () => {
  const searchUsers = async (searchTerm: string): Promise<AuditUser[]> => {
    const { data, error } = await supabase.rpc('audit_search_users', { 
      p_search_term: searchTerm 
    });
    if (error) throw error;
    return data || [];
  };

  const getEffectivePermissions = async (userId: string): Promise<EffectivePermission[]> => {
    const { data, error } = await supabase.rpc('audit_user_effective_permissions', { 
      p_user_id: userId 
    });
    if (error) throw error;
    return data || [];
  };

  const getSecurityChecks = async (): Promise<SecurityChecks> => {
    const { data, error } = await supabase.rpc('audit_security_checks');
    if (error) throw error;
    return data as SecurityChecks;
  };

  return { searchUsers, getEffectivePermissions, getSecurityChecks };
};
```

---

## 3) DEBUG COM LOGS ESTRUTURADOS

### A) Edge Function create-user (Adicionar Logs)

Arquivo: `supabase/functions/create-user/index.ts`

Adicionar apos linha 111 (apos `const hasPermission = ...`):

```typescript
// Log estruturado para debug de permissao
console.log('[create-user] Permission check:', {
  caller_id: user.id,
  caller_role: userRole?.role,
  permission_key: 'users.manage',
  permission_enabled: permission?.enabled,
  is_admin: isAdmin,
  has_permission: hasPermission
});

if (!hasPermission) {
  console.error('[create-user] DENIED:', {
    caller_id: user.id,
    caller_role: userRole?.role,
    reason: 'users.manage not enabled for this role'
  });
}
```

### B) Hook useTransferConversation (Logs Detalhados)

Arquivo: `src/hooks/useTransferConversation.tsx`

Modificar linha 112-114 (bloco de erro):

```typescript
if (rpcError) {
  console.error("[useTransferConversation] RPC error details:", {
    code: rpcError.code,
    message: rpcError.message,
    details: rpcError.details,
    hint: rpcError.hint,
    conversationId,
    toUserId: finalToUserId,
    departmentId
  });
  throw rpcError;
}
```

### C) Hook useTicketTransfer (Logs Detalhados)

Arquivo: `src/hooks/useTicketTransfer.tsx`

Modificar linha 35-37 (bloco de erro):

```typescript
if (error) {
  console.error('[useTicketTransfer] RPC error details:', {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    ticket_id,
    department_id,
    assigned_to
  });
  throw error;
}
```

### D) UserDialog.tsx (Logs no Catch)

Arquivo: `src/components/UserDialog.tsx`

Modificar linha 269-284 (bloco catch):

```typescript
} catch (error) {
  // Log estruturado para debug
  console.error("[UserDialog] Create/Update failed:", {
    mode: isEditMode ? 'edit' : 'create',
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    payload: { email, role, department, fullName }
  });
  
  if (error instanceof z.ZodError) {
    toast({
      variant: "destructive",
      title: "Erro de validacao",
      description: error.errors[0].message,
    });
  } else if (error instanceof Error) {
    toast({
      variant: "destructive",
      title: isEditMode ? "Erro ao atualizar usuario" : "Erro ao criar usuario",
      description: `${error.message} (verifique o console para detalhes)`,
    });
  }
}
```

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL | Fechar brecha + criar 3 RPCs de auditoria |
| `src/pages/PermissionsAudit.tsx` | Criar pagina nova |
| `src/hooks/usePermissionsAudit.tsx` | Criar hook de auditoria |
| `src/App.tsx` (linha 77 + linha 269) | Importar lazy + adicionar rota |
| `supabase/functions/create-user/index.ts` (linha 111) | Adicionar logs estruturados |
| `src/hooks/useTransferConversation.tsx` (linha 112) | Adicionar logs detalhados |
| `src/hooks/useTicketTransfer.tsx` (linha 35) | Adicionar logs detalhados |
| `src/components/UserDialog.tsx` (linha 269) | Adicionar logs no catch |

---

## Criterios de Aceite

| Criterio | Status Esperado |
|----------|-----------------|
| role=user com inbox.transfer | FALSE |
| role=user com tickets.assign | FALSE |
| role=user com users.manage | FALSE |
| transfer_conversation_secure GRANT | authenticated (nao PUBLIC) |
| Pagina /admin/permissions-audit | Acessivel com users.manage |
| Busca usuario mostra roles + permissoes | Funcional (1 chamada RPC) |
| Security Checks mostra RLS + DEFINER | Visivel |
| Export CSV | Funcional |
| Logs de permissao no console | Estruturados com payload |
| Erros nunca mascarados | Toast mostra message + hint |

---

## Secao Tecnica: Export CSV

```typescript
const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const val = row[h];
        if (Array.isArray(val)) return `"${val.join(', ')}"`;
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return val ?? '';
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```
