import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ExternalLink, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-purple-500" },
  general_manager: { label: "Gerente Geral", color: "bg-blue-600" },
  manager: { label: "Gerente Vendas", color: "bg-blue-500" },
  sales_rep: { label: "Vendedor", color: "bg-orange-500" },
  consultant: { label: "Consultor", color: "bg-green-500" },
  support_agent: { label: "Suporte", color: "bg-cyan-500" },
  support_manager: { label: "Ger. Suporte", color: "bg-indigo-500" },
  financial_manager: { label: "Ger. Financeiro", color: "bg-emerald-500" },
  cs_manager: { label: "Ger. CS", color: "bg-violet-500" },
};

export function PermissionsSummaryCard() {
  const navigate = useNavigate();

  const { data: permissionsSummary, isLoading } = useQuery({
    queryKey: ["super-admin-permissions-summary"],
    queryFn: async () => {
      // Get all role permissions
      const { data: permissions, error } = await supabase
        .from("role_permissions")
        .select("role, permission_key, enabled");

      if (error) throw error;

      // Get users per role
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role");

      // Group by role
      const roleStats: Record<string, { total: number; enabled: number; users: number }> = {};

      Object.keys(ROLE_LABELS).forEach(role => {
        const rolePerms = (permissions || []).filter(p => p.role === role);
        roleStats[role] = {
          total: rolePerms.length,
          enabled: rolePerms.filter(p => p.enabled === true).length,
          users: (userRoles || []).filter(u => u.role === role).length,
        };
      });

      return roleStats;
    },
    staleTime: 60 * 1000,
  });

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Permissões por Role
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => navigate("/settings")}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Gerenciar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Carregando...</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ROLE_LABELS).map(([role, { label, color }]) => {
              const stats = permissionsSummary?.[role];
              const percentage = stats && stats.total > 0 
                ? Math.round((stats.enabled / stats.total) * 100) 
                : 0;

              return (
                <div 
                  key={role} 
                  className="p-2 rounded-lg bg-muted/50 text-center"
                >
                  <div className={`h-2 w-full rounded-full bg-muted mb-2`}>
                    <div 
                      className={`h-2 rounded-full ${color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">{label}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{stats?.users || 0}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] mt-1">
                    {percentage}%
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
