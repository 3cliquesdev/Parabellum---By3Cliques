import { Crown, Shield } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { SystemMetricsCard } from "@/components/super-admin/SystemMetricsCard";
import { QuickUserManagement } from "@/components/super-admin/QuickUserManagement";
import { IntegrationStatusCard } from "@/components/super-admin/IntegrationStatusCard";
import { RecentAuditLogs } from "@/components/super-admin/RecentAuditLogs";
import { DataManagementCard } from "@/components/super-admin/DataManagementCard";
import { PermissionsSummaryCard } from "@/components/super-admin/PermissionsSummaryCard";

export default function SuperAdminPanel() {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Double-check: only admins can access
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              Painel Super Admin
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                <Shield className="h-3 w-3 mr-1" />
                Acesso Total
              </Badge>
            </h1>
            <p className="text-muted-foreground">
              Controle centralizado de todo o sistema
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Métricas do Sistema */}
        <SystemMetricsCard />

        {/* Gestão de Usuários */}
        <QuickUserManagement />

        {/* Resumo de Permissões */}
        <PermissionsSummaryCard />

        {/* Status das Integrações */}
        <IntegrationStatusCard />

        {/* Logs de Auditoria Recentes */}
        <RecentAuditLogs />

        {/* Gestão de Dados */}
        <DataManagementCard />
      </div>
    </div>
  );
}
