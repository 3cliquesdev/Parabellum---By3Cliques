import { Crown, Shield, Settings2, Users, BarChart3 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SystemMetricsCard } from "@/components/super-admin/SystemMetricsCard";
import { QuickUserManagement } from "@/components/super-admin/QuickUserManagement";
import { IntegrationStatusCard } from "@/components/super-admin/IntegrationStatusCard";
import { RecentAuditLogs } from "@/components/super-admin/RecentAuditLogs";
import { DataManagementCard } from "@/components/super-admin/DataManagementCard";
import { PermissionsSummaryCard } from "@/components/super-admin/PermissionsSummaryCard";
import InstagramSecretsCard from "@/components/settings/InstagramSecretsCard";
import SecretsConfigCard from "@/components/settings/SecretsConfigCard";
import WebhooksConfigCard from "@/components/settings/WebhooksConfigCard";

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

      {/* Tabs de navegação */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="credentials" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Credenciais Globais
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SystemMetricsCard />
            <IntegrationStatusCard />
            <PermissionsSummaryCard />
            <RecentAuditLogs />
            <DataManagementCard />
          </div>
        </TabsContent>

        {/* Tab: Credenciais Globais */}
        <TabsContent value="credentials">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InstagramSecretsCard />
            <SecretsConfigCard />
            <WebhooksConfigCard />
          </div>
        </TabsContent>

        {/* Tab: Usuários */}
        <TabsContent value="users">
          <div className="grid grid-cols-1 gap-6">
            <QuickUserManagement />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
