import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("admin" | "manager" | "sales_rep" | "consultant" | "support_agent")[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

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

  // Check role permissions (if allowedRoles is specified)
  if (allowedRoles && role && !allowedRoles.includes(role as "admin" | "manager" | "sales_rep" | "consultant" | "support_agent")) {
    console.log("ProtectedRoute: User lacks required role, redirecting to /");
    return <Navigate to="/" replace />;
  }

  console.log("ProtectedRoute: Rendering protected content");
  return <>{children}</>;
}
