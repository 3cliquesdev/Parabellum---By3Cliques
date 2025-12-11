import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useRolePermissions } from "@/hooks/useRolePermissions";

type AppRole = "admin" | "general_manager" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager" | "cs_manager";

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
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const location = useLocation();

  // Loading state - include permission loading when using requiredPermission
  const isLoading = authLoading || roleLoading || (requiredPermission && permLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // CRITICAL: Force password setup if needed (except if already on that page)
  const mustChangePassword = user?.user_metadata?.must_change_password === true;
  if (mustChangePassword && location.pathname !== "/setup-password") {
    return <Navigate to="/setup-password" replace />;
  }

  // Smart redirect based on user role
  const roleHomePage: Record<string, string> = {
    support_manager: "/support",
    support_agent: "/support",
    financial_manager: "/support",
    cs_manager: "/cs-management",
    consultant: "/my-portfolio",
    sales_rep: "/",
    general_manager: "/analytics",
    admin: "/",
    manager: "/",
  };

  // Permission-based access control (new unified system)
  if (requiredPermission && role) {
    const hasAccess = hasPermission(requiredPermission);
    
    if (!hasAccess) {
      console.log("ProtectedRoute: Permission denied", { 
        path: location.pathname, 
        role, 
        requiredPermission,
        hasAccess 
      });
      const targetPage = roleHomePage[role] || "/";
      return <Navigate to={targetPage} replace />;
    }
  }
  
  // Legacy role-based access control (kept for backward compatibility)
  if (allowedRoles && role && !allowedRoles.includes(role as AppRole)) {
    console.log("ProtectedRoute: Role not allowed (legacy)", { 
      path: location.pathname, 
      role, 
      allowedRoles 
    });
    const targetPage = roleHomePage[role] || "/";
    return <Navigate to={targetPage} replace />;
  }

  return <>{children}</>;
}
