
# Plano Final 10/10 — Upgrade Sistema Unificado de Permissões

## Análise do Estado Atual (Resumo)

| Componente | Estado | Problema |
|------------|--------|----------|
| `universalMenuGroups` | 92 items em `AppSidebar.tsx` | Precisa mover para `routes.ts` |
| `MANAGER_ROLES` | Duplicado em 2 hooks (`useTakeControl`, `useCanTakeControl`) | Precisa centralizar |
| `FULL_ACCESS_ROLES` | Definido em `useDepartmentsByRole.tsx` | Precisa mover para `roles.ts` |
| `hasPermission` | Retorna `false` enquanto carrega | Causa flicker/negação falsa |
| `/super-admin` (linha 246) | Usa `allowedRoles={["admin"]}` | Precisa migrar para `requiredPermission` |
| `useRealtimePermissions` | Só invalida `role-permissions` | Falta invalidar `user-role` |
| Função SQL `is_manager_or_admin` | **NÃO EXISTE** | Precisa criar |
| Índice `user_roles(user_id, role)` | **NÃO EXISTE** | Só existe `user_roles(user_id)` |

---

## 1. CRIAR: `src/config/roles.ts`

Arquivo novo com a fonte única de verdade para roles.

```typescript
// ========== FONTE ÚNICA DA VERDADE PARA ROLES ==========

export const FULL_ACCESS_ROLES = [
  "admin",
  "manager",
  "general_manager",
  "support_manager",
  "cs_manager",
] as const;

export type FullAccessRole = typeof FULL_ACCESS_ROLES[number];

export const hasFullAccess = (role: string | null | undefined): boolean => {
  if (!role) return false;
  return FULL_ACCESS_ROLES.includes(role as FullAccessRole);
};

export const ROLE_HOME_PAGES: Record<string, string> = {
  support_manager: "/support",
  support_agent: "/support",
  financial_manager: "/support",
  financial_agent: "/support",
  cs_manager: "/cs-management",
  consultant: "/my-portfolio",
  sales_rep: "/",
  general_manager: "/analytics",
  admin: "/",
  manager: "/",
  user: "/client-portal",
  ecommerce_analyst: "/analytics",
};
```

---

## 2. CRIAR: `src/config/routes.ts`

Mover `universalMenuGroups` de `AppSidebar.tsx` para cá (evitar dependência circular).

```typescript
import { LucideIcon, LayoutDashboard, Inbox, ... } from "lucide-react";

// ========== TIPOS ==========
export interface MenuItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

// ========== MENU UNIVERSAL (92+ items) ==========
export const universalMenuGroups: MenuGroup[] = [
  // ... exatamente como está hoje no AppSidebar.tsx
];

// ========== HELPERS ==========
export const getRouteByPath = (path: string): MenuItem | undefined => {
  for (const group of universalMenuGroups) {
    const found = group.items.find(item => item.href === path);
    if (found) return found;
  }
  return undefined;
};
```

---

## 3. ATUALIZAR: `src/components/AppSidebar.tsx`

Remover definição local de `universalMenuGroups` e importar de `@/config/routes`.

**Mudanças:**
- Remover linhas 75-190 (tipos + definição do menu)
- Adicionar import no topo: `import { universalMenuGroups, MenuItem, MenuGroup } from "@/config/routes";`

---

## 4. UPGRADE: `src/hooks/useRolePermissions.tsx`

Implementar tri-state `true | false | undefined` para evitar negação enquanto carrega.

```typescript
import { hasFullAccess } from "@/config/roles";

export function useRolePermissions() {
  const { role } = useUserRole();

  const { data: permissions, isLoading } = useQuery({
    // ... mantém query existente
  });

  // NOVO: Estado "pronto" para verificar permissões
  const ready = !isLoading && permissions !== undefined;

  // TRI-STATE: true | false | undefined
  const hasPermission = (key: string): boolean | undefined => {
    // Roles com acesso total sempre true
    if (hasFullAccess(role)) return true;
    
    // 🔥 CRÍTICO: Não negar enquanto carrega
    if (!ready) return undefined;
    
    // enabled === true é a única condição válida
    return permissions?.[key] === true;
  };

  return { 
    permissions, 
    hasPermission, 
    loading: isLoading,
    ready,  // NOVO
  };
}
```

---

## 5. CRIAR: `src/components/AccessDenied.tsx`

Componente visual para substituir redirect silencioso.

```typescript
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { ROLE_HOME_PAGES } from "@/config/roles";

interface AccessDeniedProps {
  permission?: string;
}

export function AccessDenied({ permission }: AccessDeniedProps) {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const homePage = role ? ROLE_HOME_PAGES[role] || "/" : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-8">
        <ShieldX className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground mb-6">
          Você não tem permissão para acessar esta página.
        </p>
        {permission && import.meta.env.DEV && (
          <span className="block mt-2 mb-4 text-xs font-mono bg-muted px-2 py-1 rounded">
            Permissão necessária: {permission}
          </span>
        )}
        <Button onClick={() => navigate(homePage)}>
          Ir para página inicial
        </Button>
      </div>
    </div>
  );
}
```

---

## 6. UPGRADE: `src/components/ProtectedRoute.tsx`

Usar `AccessDenied` + respeitar tri-state.

**Mudanças principais:**
1. Importar `AccessDenied` e `hasFullAccess`
2. Usar `ready` do hook para loading
3. Tratar `hasPermission === undefined` como loading
4. Mostrar `<AccessDenied />` em vez de redirect silencioso
5. Adicionar logs de diagnóstico em DEV

```typescript
import { AccessDenied } from "@/components/AccessDenied";
import { hasFullAccess, ROLE_HOME_PAGES } from "@/config/roles";

// ...

// Loading state MELHORADO
const isLoading = authLoading || roleLoading || (requiredPermission && !ready);

if (isLoading) {
  return <PageLoadingSkeleton />;
}

// Permission check
if (requiredPermission) {
  const access = hasPermission(requiredPermission);
  
  // Tri-state: undefined = still loading
  if (access === undefined) {
    return <PageLoadingSkeleton />;
  }
  
  if (access === false) {
    if (import.meta.env.DEV) {
      console.log("[ProtectedRoute] Acesso negado", { 
        path: location.pathname, 
        role, 
        requiredPermission,
        isFullAccessRole: hasFullAccess(role)
      });
    }
    return <AccessDenied permission={requiredPermission} />;
  }
}

// Legacy role-based (deprecated)
if (allowedRoles && role && !allowedRoles.includes(role as AppRole)) {
  if (import.meta.env.DEV) {
    console.log("[ProtectedRoute] Role negado (legacy)", { role, allowedRoles });
  }
  return <AccessDenied />;
}
```

---

## 7. ATUALIZAR: `src/App.tsx` (linha 246)

Migrar `/super-admin` para `requiredPermission`.

**Antes:**
```typescript
<Route path="/super-admin" element={<ProtectedRoute allowedRoles={["admin"]}>
```

**Depois:**
```typescript
<Route path="/super-admin" element={<ProtectedRoute requiredPermission="super_admin.access">
```

---

## 8. REFATORAR: Hooks com listas duplicadas

### `src/hooks/useTakeControl.tsx` (linha 52)
**Antes:**
```typescript
const MANAGER_ROLES = ['admin', 'manager', 'general_manager', 'support_manager', 'cs_manager'];
```

**Depois:**
```typescript
import { FULL_ACCESS_ROLES, hasFullAccess } from "@/config/roles";
// ...
const isManagerOrAdmin = hasFullAccess(userRole);
```

### `src/hooks/useCanTakeControl.tsx` (linha 69)
**Mesma mudança acima.**

### `src/hooks/useDepartmentsByRole.tsx` (linha 47-53)
**Antes:**
```typescript
export const FULL_ACCESS_ROLES = [ "admin", ... ];
export function hasFullInboxAccess(role) { ... }
```

**Depois:**
```typescript
import { FULL_ACCESS_ROLES, hasFullAccess } from "@/config/roles";
export { FULL_ACCESS_ROLES };
export const hasFullInboxAccess = hasFullAccess; // alias para compatibilidade
```

---

## 9. UPGRADE: `src/hooks/useRealtimePermissions.tsx`

Invalidar mais queries para garantir re-render do menu.

```typescript
import { useAuth } from "./useAuth";

export function useRealtimePermissions() {
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!role) return;

    const channel = supabase
      .channel('role-permissions-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'role_permissions',
        filter: `role=eq.${role}`,
      }, () => {
        // ✅ Invalidar TODAS as queries relacionadas
        queryClient.invalidateQueries({ queryKey: ['role-permissions', role] });
        queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
        queryClient.invalidateQueries({ queryKey: ['user-role', user?.id] });
        
        // ✅ Force re-render via version bump
        queryClient.setQueryData(["permissions-version"], (v: number) => (v || 0) + 1);
        
        toast.info("🔄 Suas permissões foram atualizadas!", {
          description: "A página será atualizada automaticamente.",
          duration: 3000,
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, user?.id, queryClient]);
}
```

---

## 10. UPGRADE: Sidebar respeitar tri-state (loading)

**No `getFilteredMenuGroups` do `AppSidebar.tsx`:**

```typescript
const getFilteredMenuGroups = (): MenuGroup[] => {
  // 🔥 Se permissões ainda carregando, mostrar skeleton ou vazio
  // Evita renderizar menu errado e depois "piscar"
  if (permissionsLoading) return [];
  
  return universalMenuGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const perm = hasPermission(item.permission);
        // undefined = ainda carregando, ocultar item
        return perm === true;
      })
    }))
    .filter(group => group.items.length > 0);
};
```

---

## 11. BACKEND: Criar função SQL + índice

### Função `is_manager_or_admin`

```sql
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'general_manager', 'support_manager', 'cs_manager')
  );
$$;
```

### Índice composto (para performance)

```sql
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role
ON public.user_roles (user_id, role);
```

**Nota:** Será usado em policies críticas para alinhar RLS com frontend.

---

## Arquivos Afetados (Resumo)

| Arquivo | Ação | Risco |
|---------|------|-------|
| `src/config/roles.ts` | **CRIAR** | Nenhum |
| `src/config/routes.ts` | **CRIAR** | Nenhum |
| `src/components/AccessDenied.tsx` | **CRIAR** | Nenhum |
| `src/hooks/useRolePermissions.tsx` | **ATUALIZAR** | Baixo - adiciona `ready` |
| `src/components/ProtectedRoute.tsx` | **ATUALIZAR** | Médio - lógica de loading |
| `src/components/AppSidebar.tsx` | **ATUALIZAR** | Baixo - mover menu para routes.ts |
| `src/hooks/useRealtimePermissions.tsx` | **ATUALIZAR** | Baixo - mais invalidações |
| `src/hooks/useTakeControl.tsx` | **ATUALIZAR** | Nenhum - só import |
| `src/hooks/useCanTakeControl.tsx` | **ATUALIZAR** | Nenhum - só import |
| `src/hooks/useDepartmentsByRole.tsx` | **ATUALIZAR** | Nenhum - só import |
| `src/App.tsx` | **ATUALIZAR** | Nenhum - 1 linha |
| **SQL** | **CRIAR** função + índice | Nenhum |

---

## Critérios de Aceite (PASS/FAIL)

| # | Critério | Validação |
|---|----------|-----------|
| 1 | **Sem flicker** | Menu não pisca ao carregar; aparece após skeleton |
| 2 | **Sem redirect fantasma** | Rota sem permissão mostra `<AccessDenied />` |
| 3 | **Sem link falso** | Item sem permissão não é renderizado no menu |
| 4 | **Realtime OK** | Permissão alterada reflete sem refresh (menu + rota) |
| 5 | **Gerente sem 403** | `manager`/`general_manager` acessam tudo |
| 6 | **Super Admin** | Funciona **somente** com `super_admin.access` |

---

## Checklist de Teste Rápido (5 min)

1. **Usuário `sales_rep`**: deve ver apenas menus de vendas
2. **Usuário `support_agent`**: deve ver apenas menus de suporte
3. **Usuário `admin`**: deve ver todos os menus + `/super-admin`
4. **Alterar permissão via admin**: menu do outro usuário deve atualizar sem F5
5. **Acessar URL direta sem permissão**: deve mostrar `<AccessDenied />`, não redirect

---

## Conformidade com Base de Conhecimento

| Regra | Status |
|-------|--------|
| Preservação do existente | ✅ Nenhuma funcionalidade removida |
| Upgrade, não downgrade | ✅ Adiciona feedback e consistência |
| Zero regressão | ✅ Testes antes de entregar |
| allowedRoles legado | ✅ Mantido @deprecated |
| Console sem erros | ✅ Será validado |
| Responsividade | ✅ `AccessDenied` é responsivo |
