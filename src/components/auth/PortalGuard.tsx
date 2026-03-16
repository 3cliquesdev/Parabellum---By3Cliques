import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";
import { ROLE_HOME_PAGES } from "@/config/roles";

interface PortalGuardProps {
  children: React.ReactNode;
}

/**
 * Guard exclusivo para rotas do portal do cliente.
 * - Não autenticado → /portal (login do cliente)
 * - Role diferente de 'user' → home page do role
 * - Role 'user' → renderiza children
 */
export function PortalGuard({ children }: PortalGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return <PageLoadingSkeleton />;
  }

  if (!user) {
    return <Navigate to="/portal" replace />;
  }

  // Se não é cliente, redireciona para a home do role
  if (role && role !== "user") {
    const homePage = ROLE_HOME_PAGES[role] || "/";
    return <Navigate to={homePage} replace />;
  }

  return <>{children}</>;
}
