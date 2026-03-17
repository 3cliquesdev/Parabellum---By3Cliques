import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, ShieldCheck, ShieldX, Search, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useAllRolePermissions, useUpdatePermission, RolePermission } from "@/hooks/useRolePermissions";
import { useSyncPermissions } from "@/hooks/useSyncPermissions";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  general_manager: { label: "Gerente Geral", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  manager: { label: "Gerente de Vendas", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  sales_rep: { label: "Vendedor", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  consultant: { label: "Consultor CS", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  support_agent: { label: "Atendente", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400" },
  support_manager: { label: "Gerente de Suporte", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400" },
  financial_manager: { label: "Gestor Financeiro", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  financial_agent: { label: "Agente Financeiro", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  cs_manager: { label: "Gerente de CS", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400" },
  ecommerce_analyst: { label: "Analista E-commerce", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const CATEGORY_LABELS: Record<string, { label: string }> = {
  deals: { label: "Negócios" },
  dashboard: { label: "Dashboard" },
  knowledge: { label: "Base de Conhecimento" },
  cadences: { label: "Cadências" },
  users: { label: "Usuários" },
  products: { label: "Produtos" },
  reports: { label: "Relatórios" },
  inbox: { label: "Inbox / Suporte" },
  contacts: { label: "Contatos" },
  tickets: { label: "Tickets" },
  quotes: { label: "Orçamentos" },
  forms: { label: "Formulários" },
  email: { label: "Email" },
  automations: { label: "Automações" },
  playbooks: { label: "Playbooks" },
  ai: { label: "Inteligência Artificial" },
  cs: { label: "Customer Success" },
  sales: { label: "Gestão de Vendas" },
  analytics: { label: "Analytics" },
  settings: { label: "Configurações" },
  audit: { label: "Auditoria" },
  cadastros: { label: "Cadastros" },
  goals: { label: "Metas" },
  projects: { label: "Projetos" },
  Sistema: { label: "Sistema" },
};

// Define category display order
const CATEGORY_ORDER = [
  'inbox', 'contacts', 'deals', 'tickets', 'quotes', 'forms',
  'playbooks', 'automations', 'email', 'ai', 
  'cs', 'sales', 'analytics', 'goals', 'projects',
  'cadastros', 'knowledge', 'cadences', 'products', 'users',
  'settings', 'audit', 'dashboard', 'reports', 'Sistema'
];

export function RolePermissionsManager() {
  const { data: permissions, isLoading } = useAllRolePermissions();
  const updatePermission = useUpdatePermission();
  const { syncPermissions, syncing } = useSyncPermissions();
  const [activeRole, setActiveRole] = useState("general_manager");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));

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
  
  // Filter by search query
  const filteredPermissions = searchQuery
    ? currentRolePermissions.filter(p => 
        p.permission_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.permission_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (CATEGORY_LABELS[p.permission_category]?.label || p.permission_category).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentRolePermissions;

  const permissionsByCategory = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.permission_category]) acc[perm.permission_category] = [];
    acc[perm.permission_category].push(perm);
    return acc;
  }, {} as Record<string, RolePermission[]>);

  // Sort categories by defined order
  const sortedCategories = Object.keys(permissionsByCategory).sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a);
    const indexB = CATEGORY_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

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

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const enabledCount = currentRolePermissions.filter((p) => p.enabled).length;
  const totalCount = currentRolePermissions.length;

  // Enable/disable all in category
  const toggleAllInCategory = async (category: string, enable: boolean) => {
    if (activeRole === "admin") {
      toast.error("Permissões do administrador não podem ser alteradas");
      return;
    }

    const categoryPerms = permissionsByCategory[category] || [];
    const toUpdate = categoryPerms.filter(p => p.enabled !== enable);
    
    for (const perm of toUpdate) {
      await updatePermission.mutateAsync({ id: perm.id, enabled: enable });
    }

    toast.success(`${enable ? "Ativadas" : "Desativadas"} todas as permissões de ${CATEGORY_LABELS[category]?.label || category}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Permissões por Cargo</CardTitle>
        </div>
        <CardDescription>
          Configure as permissões de acesso para cada cargo do sistema ({totalCount} permissões disponíveis)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeRole} onValueChange={setActiveRole}>
          <ScrollArea className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 mb-6 w-max min-w-full">
              {Object.entries(ROLE_LABELS).map(([role, { label }]) => (
                <TabsTrigger
                  key={role}
                  value={role}
                  className="text-xs px-3 py-1.5 whitespace-nowrap"
                  disabled={role === "admin"}
                >
                  {label}
                  {role === "admin" && " 🔒"}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          {Object.keys(ROLE_LABELS).map((role) => (
            <TabsContent key={role} value={role} className="space-y-4">
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
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar permissão..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {sortedCategories.map((category) => {
                        const perms = permissionsByCategory[category];
                        const categoryEnabledCount = perms.filter(p => p.enabled).length;
                        const isExpanded = expandedCategories.has(category);

                        return (
                          <Collapsible
                            key={category}
                            open={isExpanded}
                            onOpenChange={() => toggleCategory(category)}
                          >
                            <div className="border rounded-lg overflow-hidden">
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className="font-medium text-sm">
                                      {CATEGORY_LABELS[category]?.label || category}
                                    </span>
                                  </div>
                                  <Badge variant={categoryEnabledCount === perms.length ? "default" : categoryEnabledCount === 0 ? "destructive" : "secondary"}>
                                    {categoryEnabledCount}/{perms.length}
                                  </Badge>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="divide-y">
                                  {/* Quick actions */}
                                  <div className="flex items-center gap-2 p-2 bg-background border-t">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleAllInCategory(category, true); }}
                                      className="text-xs text-primary hover:underline"
                                    >
                                      Ativar todos
                                    </button>
                                    <span className="text-muted-foreground">•</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleAllInCategory(category, false); }}
                                      className="text-xs text-destructive hover:underline"
                                    >
                                      Desativar todos
                                    </button>
                                  </div>
                                  {perms.map((permission) => (
                                    <div
                                      key={permission.id}
                                      className="flex items-center justify-between p-3 bg-background hover:bg-muted/20 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        {permission.enabled ? (
                                          <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
                                        ) : (
                                          <ShieldX className="h-4 w-4 text-muted-foreground shrink-0" />
                                        )}
                                        <div>
                                          <span className="text-sm">{permission.permission_label}</span>
                                          <p className="text-xs text-muted-foreground">{permission.permission_key}</p>
                                        </div>
                                      </div>
                                      <Switch
                                        checked={permission.enabled}
                                        onCheckedChange={() => handleToggle(permission)}
                                        disabled={updatePermission.isPending}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
