import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ShieldCheck, ShieldX } from "lucide-react";
import { useAllRolePermissions, useUpdatePermission, RolePermission } from "@/hooks/useRolePermissions";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  general_manager: { label: "Gerente Geral", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  manager: { label: "Gerente", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  sales_rep: { label: "Vendedor", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  consultant: { label: "Consultor", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  support_agent: { label: "Agente Suporte", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400" },
  support_manager: { label: "Gerente Suporte", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400" },
  financial_manager: { label: "Gerente Financeiro", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  cs_manager: { label: "Gerente CS", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400" },
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  deals: { label: "Negócios", icon: "💰" },
  dashboard: { label: "Dashboard", icon: "📊" },
  knowledge: { label: "Base de Conhecimento", icon: "📚" },
  cadences: { label: "Cadências", icon: "🔄" },
  users: { label: "Usuários", icon: "👥" },
  products: { label: "Produtos", icon: "📦" },
  reports: { label: "Relatórios", icon: "📈" },
};

export function RolePermissionsManager() {
  const { data: permissions, isLoading } = useAllRolePermissions();
  const updatePermission = useUpdatePermission();
  const [activeRole, setActiveRole] = useState("general_manager");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group permissions by role
  const permissionsByRole = permissions?.reduce((acc, perm) => {
    if (!acc[perm.role]) acc[perm.role] = [];
    acc[perm.role].push(perm);
    return acc;
  }, {} as Record<string, RolePermission[]>) || {};

  // Group permissions by category for current role
  const currentRolePermissions = permissionsByRole[activeRole] || [];
  const permissionsByCategory = currentRolePermissions.reduce((acc, perm) => {
    if (!acc[perm.permission_category]) acc[perm.permission_category] = [];
    acc[perm.permission_category].push(perm);
    return acc;
  }, {} as Record<string, RolePermission[]>);

  const handleToggle = async (permission: RolePermission) => {
    if (activeRole === "admin") {
      toast.error("Permissões do administrador não podem ser alteradas");
      return;
    }

    await updatePermission.mutateAsync({
      id: permission.id,
      enabled: !permission.enabled,
    });

    toast.success(
      `Permissão "${permission.permission_label}" ${!permission.enabled ? "ativada" : "desativada"} para ${ROLE_LABELS[activeRole]?.label}`
    );
  };

  const enabledCount = currentRolePermissions.filter((p) => p.enabled).length;
  const totalCount = currentRolePermissions.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Permissões por Cargo</CardTitle>
        </div>
        <CardDescription>
          Configure as permissões de acesso para cada cargo do sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeRole} onValueChange={setActiveRole}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
            {Object.entries(ROLE_LABELS).map(([role, { label }]) => (
              <TabsTrigger
                key={role}
                value={role}
                className="text-xs px-3 py-1.5"
                disabled={role === "admin"}
              >
                {label}
                {role === "admin" && " 🔒"}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.keys(ROLE_LABELS).map((role) => (
            <TabsContent key={role} value={role} className="space-y-6">
              {/* Summary */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className={ROLE_LABELS[role]?.color}>
                    {ROLE_LABELS[role]?.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {enabledCount} de {totalCount} permissões ativas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {enabledCount === totalCount ? (
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  ) : enabledCount === 0 ? (
                    <ShieldX className="h-5 w-5 text-red-500" />
                  ) : (
                    <Shield className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
              </div>

              {role === "admin" ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">Acesso Total</p>
                  <p className="text-sm">
                    O administrador possui todas as permissões e não pode ser restringido.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="space-y-3">
                      <h3 className="font-medium flex items-center gap-2 text-sm text-foreground">
                        <span>{CATEGORY_LABELS[category]?.icon || "⚙️"}</span>
                        {CATEGORY_LABELS[category]?.label || category}
                      </h3>
                      <div className="grid gap-2">
                        {perms.map((permission) => (
                          <div
                            key={permission.id}
                            className="flex items-center justify-between p-3 bg-background border rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {permission.enabled ? (
                                <ShieldCheck className="h-4 w-4 text-green-500" />
                              ) : (
                                <ShieldX className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">{permission.permission_label}</span>
                            </div>
                            <Switch
                              checked={permission.enabled}
                              onCheckedChange={() => handleToggle(permission)}
                              disabled={updatePermission.isPending}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
