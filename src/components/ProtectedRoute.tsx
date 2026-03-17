import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { AccessDenied } from "@/components/AccessDenied";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";
import { hasFullAccess, ROLE_HOME_PAGES } from "@/config/roles";

type AppRole = "admin" | "general_manager" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager" | "financial_agent" | "cs_manager";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** @deprecated Use requiredPermission instead for dynamic permission-based access */
  allowedRoles?: AppRole[];
  /** Permission key to check (e.g., "forms.view", "inbox.access") */
  requiredPermission?: string;
}

export default function ProtectedRoute({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission, ready: permReady, loading: permLoading } = useRolePermissions();
  const location = useLocation();

  // Loading state - auth e role sempre precisam carregar
  if (authLoading || roleLoading) {
    return <PageLoadingSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // CRITICAL: Force password setup if needed (except if already on that page)
  const mustChangePassword = user?.user_metadata?.must_change_password === true;
  if (mustChangePassword && location.pathname !== "/setup-password") {
    return <Navigate to="/setup-password" replace />;
  }

  // Permission-based access control (new unified system)
  if (requiredPermission) {
    // ✅ SEGURANÇA: Roles com acesso total NUNCA devem ser bloqueados
    if (hasFullAccess(role)) {
      return <>{children}</>;
    }
    
    // Espera permissões ficarem prontas (nunca nega enquanto carrega)
    if (!permReady || permLoading) {
      return <PageLoadingSkeleton />;
    }

    const access = hasPermission(requiredPermission);
    
    // Tri-state: undefined = still loading
    if (access === undefined) {
      return <PageLoadingSkeleton />;
    }
    
    if (access === false) {
      // Logs de diagnóstico (apenas DEV)
      if (import.meta.env.DEV) {
        console.log("[ProtectedRoute] Acesso negado", { 
          path: location.pathname, 
          role, 
          requiredPermission,
          isFullAccessRole: hasFullAccess(role)
        });
      }
      
      // ✅ NOVO: Mostrar AccessDenied em vez de redirect silencioso
      return <AccessDenied permission={requiredPermission} />;
    }
  }
  
  // Legacy role-based access control (kept for backward compatibility)
  // @deprecated - migrar para requiredPermission
  if (allowedRoles && role && !allowedRoles.includes(role as AppRole)) {
    if (import.meta.env.DEV) {
      console.log("[ProtectedRoute] Role não permitido (legacy)", { 
        path: location.pathname, 
        role, 
        allowedRoles 
      });
    }
    return <AccessDenied />;
  }

  return <>{children}</>;
}
