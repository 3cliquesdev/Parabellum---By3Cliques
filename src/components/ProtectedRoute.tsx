import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("admin" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager")[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  console.log("ProtectedRoute: Render", { isAuthenticated, authLoading, roleLoading, role, allowedRoles });

  if (authLoading || roleLoading) {
    console.log("ProtectedRoute: Showing loading state");
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
    console.log("ProtectedRoute: Redirecting to /auth");
    return <Navigate to="/auth" replace />;
  }

  // CRITICAL: Forçar setup de senha se necessário (exceto se já estiver na página)
  const mustChangePassword = user?.user_metadata?.must_change_password === true;
  if (mustChangePassword && location.pathname !== "/setup-password") {
    console.log("ProtectedRoute: User must change password, redirecting to /setup-password");
    return <Navigate to="/setup-password" replace />;
  }

  // Check role permissions (if allowedRoles is specified)
  if (allowedRoles && role && !allowedRoles.includes(role as "admin" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager")) {
    console.log("ProtectedRoute: User lacks required role, smart redirecting based on role");
    
    // Smart redirect based on user role
    const roleHomePage: Record<string, string> = {
      support_manager: "/support",
      support_agent: "/support",
      financial_manager: "/support",
      consultant: "/my-portfolio",
      sales_rep: "/",
      admin: "/",
      manager: "/",
    };
    
    const targetPage = roleHomePage[role] || "/";
    return <Navigate to={targetPage} replace />;
  }

  console.log("ProtectedRoute: Rendering protected content");
  return <>{children}</>;
}
