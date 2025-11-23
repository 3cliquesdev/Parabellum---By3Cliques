import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();

  console.log("ProtectedRoute: Render", { isAuthenticated, loading });

  if (loading) {
    console.log("ProtectedRoute: Showing loading state");
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  console.log("ProtectedRoute: Rendering protected content");
  return <>{children}</>;
}
