import { useLocation, useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, 
  Inbox,
  Users, 
  Building2, 
  TrendingUp, 
  FileText,
  Settings,
  UserCog,
  Zap,
  Mail,
  LogOut,
  BarChart3,
  Target,
  Upload,
  Headphones,
  Brain,
  Package,
  Briefcase,
  Book,
  Ticket,
  MessageCircle,
  DollarSign,
  CheckSquare,
  Workflow,
  Receipt,
  RefreshCw,
  CheckCircle2,
  Tags,
  AlertTriangle,
  Crown,
  ClipboardList,
  Kanban,
  Instagram,
  LucideIcon
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useUserRole } from "@/hooks/useUserRole";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useRealtimePermissions } from "@/hooks/useRealtimePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import logoLight from "@/assets/logo-parabellum-light.png";
import logoDark from "@/assets/logo-parabellum-dark.png";
import { useAvailabilityStatus } from "@/hooks/useAvailabilityStatus";
import { supabase } from "@/integrations/supabase/client";
import { useSLAAlerts } from "@/hooks/useSLAAlerts";
import { useMyPendingCounts } from "@/hooks/useMyPendingCounts";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/ModeToggle";
import { SidebarVersionIndicator } from "@/components/SidebarVersionIndicator";
import ProfileEditDialog from "@/components/ProfileEditDialog";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";

// ============= IMPORTAR MENU DA FONTE ÚNICA =============
import { universalMenuGroups, MenuItem, MenuGroup } from "@/config/routes";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const queryClient = useQueryClient();
  const { role, isAdmin, isManager, isSalesRep, isConsultant, isSupportAgent, isSupportManager, isFinancialManager, isFinancialAgent, isCSManager, isGeneralManager, loading } = useUserRole();
  const { hasPermission, loading: permissionsLoading, ready: permissionsReady } = useRolePermissions();
  useRealtimePermissions(); // Sincronização em tempo real
  const { signOut, user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status: availabilityStatus } = useAvailabilityStatus();
  const { data: slaAlerts = [] } = useSLAAlerts();
  const { data: myPendingCounts } = useMyPendingCounts();
  const { theme } = useTheme();

  // ============= PREFETCH STRATEGY =============
  // Prefetch BOTH module chunks AND data on hover for instant navigation
  const handlePrefetch = useCallback((route: string) => {
    // 1. Prefetch do módulo (chunk) da página - instant load
    const modulePrefetches: Record<string, () => Promise<unknown>> = {
      '/': () => import('../pages/Dashboard'),
      '/inbox': () => import('../pages/Inbox'),
      '/contacts': () => import('../pages/Contacts'),
      '/deals': () => import('../pages/Deals'),
      '/support': () => import('../pages/Support'),
      '/analytics': () => import('../pages/Analytics'),
      '/subscriptions': () => import('../pages/Subscriptions'),
      '/sales-management': () => import('../pages/SalesManagement'),
      '/cs-management': () => import('../pages/CSManagement'),
      '/my-portfolio': () => import('../pages/MyPortfolio'),
      '/settings': () => import('../pages/Settings'),
      '/forms': () => import('../pages/Forms'),
      '/email-templates': () => import('../pages/EmailTemplates'),
      '/automations': () => import('../pages/Automations'),
      '/projects': () => import('../pages/ProjectsPage'),
      '/quotes': () => import('../pages/Quotes'),
      '/organizations': () => import('../pages/Organizations'),
      '/users': () => import('../pages/Users'),
      '/knowledge': () => import('../pages/Knowledge'),
    };
    
    // Prefetch do módulo se existir
    if (modulePrefetches[route]) {
      modulePrefetches[route]().catch(() => {/* ignore errors */});
    }

    // 2. Prefetch de dados (já existente)
    switch(route) {
      case '/inbox':
        queryClient.prefetchQuery({
          queryKey: ['inbox-view'],
          queryFn: async () => {
            const { data } = await supabase
              .from('inbox_view')
              .select('*')
              .eq('status', 'open')
              .order('last_message_at', { ascending: false })
              .limit(50);
            return data;
          },
          staleTime: 30 * 1000,
        });
        break;
      case '/contacts':
        queryClient.prefetchQuery({
          queryKey: ['contacts'],
          queryFn: async () => {
            const { data } = await supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone, status')
              .order('created_at', { ascending: false })
              .limit(50);
            return data;
          },
          staleTime: 60 * 1000,
        });
        break;
      case '/deals':
        queryClient.prefetchQuery({
          queryKey: ['deals-prefetch'],
          queryFn: async () => {
            const { data } = await supabase
              .from('deals')
              .select('id, title, value, status, stage_id')
              .eq('status', 'open')
              .order('created_at', { ascending: false })
              .limit(50);
            return data;
          },
          staleTime: 60 * 1000,
        });
        break;
      case '/support':
        queryClient.prefetchQuery({
          queryKey: ['tickets-prefetch'],
          queryFn: async () => {
            const { data } = await supabase
              .from('tickets')
              .select('id, subject, status, priority, ticket_number')
              .neq('status', 'closed')
              .order('created_at', { ascending: false })
              .limit(50);
            return data;
          },
          staleTime: 30 * 1000,
        });
        break;
    }
  }, [queryClient]);

  // Determine mode label and color
  const getModeInfo = () => {
    if (isSupportManager && !isAdmin && !isManager && !isGeneralManager) return { label: "Gerente de Suporte", color: "bg-indigo-500" };
    if (isSupportAgent && !isSupportManager && !isAdmin && !isManager && !isGeneralManager) return { label: "Modo Suporte", color: "bg-blue-500" };
    if (isFinancialManager && !isAdmin && !isManager && !isGeneralManager) return { label: "Gerente Financeiro", color: "bg-emerald-500" };
    if (isFinancialAgent && !isFinancialManager && !isAdmin && !isManager && !isGeneralManager) return { label: "Agente Financeiro", color: "bg-amber-500" };
    if (isCSManager && !isAdmin && !isManager && !isGeneralManager) return { label: "Gerente de CS", color: "bg-purple-600" };
    if (isConsultant && !isAdmin && !isManager && !isGeneralManager) return { label: "Modo Consultor", color: "bg-green-500" };
    if (isSalesRep && !isAdmin && !isManager && !isGeneralManager) return { label: "Modo Vendas", color: "bg-orange-500" };
    if (isManager && !isAdmin && !isGeneralManager) return { label: "Gerente de Vendas", color: "bg-blue-600" };
    if (isGeneralManager && !isAdmin) return { label: "Gerente Geral", color: "bg-blue-600" };
    if (isAdmin) return { label: "Modo Admin", color: "bg-purple-500" };
    return { label: "Sistema", color: "bg-gray-500" };
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const modeInfo = getModeInfo();

  const handleSignOut = async () => {
    console.log("AppSidebar: handleSignOut clicked");
    await signOut();
    console.log("AppSidebar: signOut finished, reloading to /auth");
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    window.location.href = "/auth";
  };

  // ============= MENU 100% DINÂMICO =============
  // Filtra grupos e itens EXCLUSIVAMENTE por permissões
  // TRI-STATE: só renderiza itens quando permissões estão prontas
  const getFilteredMenuGroups = (): MenuGroup[] => {
    // 🔥 Se permissões ainda carregando, retornar vazio
    // Evita renderizar menu errado e depois "piscar"
    if (permissionsLoading || !permissionsReady) return [];
    
    return universalMenuGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => {
          const perm = hasPermission(item.permission);
          // undefined = ainda carregando, ocultar item
          // true = permitido, mostrar item
          // false = negado, ocultar item
          return perm === true;
        })
      }))
      .filter(group => group.items.length > 0);
  };

  // Render a single menu item
  const renderMenuItem = (item: MenuItem) => {
    // Show SLA alert badge on Inbox for admins/managers/general_managers
    const showSLABadge = (isAdmin || isManager || isGeneralManager) && item.href === "/inbox" && slaAlerts.length > 0;
    
    // Badge de pendências pessoais - Inbox
    const inboxBadge = item.href === "/inbox" && (myPendingCounts?.inbox || 0) > 0;
    const inboxCount = myPendingCounts?.inbox || 0;
    
    // Badge de pendências pessoais - Tickets
    const ticketsBadge = item.href === "/support" && (myPendingCounts?.tickets || 0) > 0;
    const ticketsCount = myPendingCounts?.tickets || 0;
    
    // Badge de pendências pessoais - Deals
    const dealsBadge = item.href === "/deals" && (myPendingCounts?.deals || 0) > 0;
    const dealsCount = myPendingCounts?.deals || 0;
    
    // Determinar qual badge mostrar (prioridade: SLA > pendências pessoais)
    const showPersonalBadge = !showSLABadge && (inboxBadge || ticketsBadge || dealsBadge);
    const personalCount = inboxBadge ? inboxCount : ticketsBadge ? ticketsCount : dealsCount;

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.href}
            end={item.href === "/"}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-700 dark:text-slate-300 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors relative"
            activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary hover:bg-primary/10 hover:text-primary"
            onMouseEnter={() => handlePrefetch(item.href)}
            onFocus={() => handlePrefetch(item.href)}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && (
              <span className="flex items-center gap-2 flex-1">
                {item.title}
                {showSLABadge && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    {slaAlerts.length}
                  </Badge>
                )}
                {showPersonalBadge && (
                  <Badge className="text-xs px-1.5 py-0 bg-primary text-primary-foreground">
                    {personalCount}
                  </Badge>
                )}
              </span>
            )}
            {collapsed && showSLABadge && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] flex items-center justify-center text-white font-bold">
                {slaAlerts.length}
              </span>
            )}
            {collapsed && showPersonalBadge && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] flex items-center justify-center text-primary-foreground font-bold">
                {personalCount}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  // Get filtered menu structure based on permissions only
  const menuGroups = getFilteredMenuGroups();

  return (
    <Sidebar className={cn(
      collapsed ? "w-[60px]" : "w-[280px]",
      "bg-card border-r-2 border-slate-200 dark:border-border"
    )} collapsible="icon">
      {/* Header com Logo e Badge de Modo */}
      <SidebarHeader className="border-b-2 border-slate-200 dark:border-border p-4">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <img 
                src={theme === "dark" ? logoLight : logoDark} 
                alt="Parabellum Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <Badge variant="secondary" className="w-full justify-center text-xs font-medium">
              {modeInfo.label}
            </Badge>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center mx-auto">
              <img 
                src={theme === "dark" ? logoLight : logoDark} 
                alt="Parabellum Logo" 
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className={`h-1 w-8 rounded mx-auto ${modeInfo.color}`} />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Loading state */}
        {(loading || permissionsLoading) ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Carregando menu...</div>
          </div>
        ) : (
          <>
            {/* Render all menu groups dynamically based on permissions */}
            {menuGroups.map((group) => (
              <SidebarGroup key={group.label}>
                {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(renderMenuItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </>
        )}
      </SidebarContent>

      {/* Footer com perfil do usuário */}
      <SidebarFooter className="border-t border-border p-4">
        {!collapsed ? (
          <div className="space-y-3">
            {/* Status Toggle - apenas para agentes/consultores */}
            {(isSupportAgent || isConsultant || isSalesRep) && !isAdmin && !isManager && (
              <AvailabilityToggle />
            )}

            {/* Profile info */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={profile?.avatar_url || undefined} 
                    alt={profile?.full_name || "Usuário"} 
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {/* Status indicator dot */}
                {(isSupportAgent || isConsultant || isSalesRep) && !isAdmin && !isManager && (
                  <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-sidebar ${getStatusColor(availabilityStatus)}`} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.full_name || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || ""}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <ProfileEditDialog trigger={
                <Button variant="ghost" size="icon" className="h-9 w-9" title="Editar Perfil">
                  <UserCog className="h-4 w-4" />
                </Button>
              } />
              <ModeToggle />
              <SidebarVersionIndicator />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                title="Sair"
                className="h-9 w-9"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Status Toggle - apenas para agentes/consultores */}
            {(isSupportAgent || isConsultant || isSalesRep) && !isAdmin && !isManager && (
              <div className="flex justify-center">
                <AvailabilityToggle />
              </div>
            )}

            {/* Avatar with status */}
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={profile?.avatar_url || undefined} 
                    alt={profile?.full_name || "Usuário"} 
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {/* Status indicator dot */}
                {(isSupportAgent || isConsultant || isSalesRep) && !isAdmin && !isManager && (
                  <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-sidebar ${getStatusColor(availabilityStatus)}`} />
                )}
              </div>
            </div>

            {/* Compact action buttons */}
            <div className="flex flex-col gap-1">
              <ProfileEditDialog trigger={
                <Button variant="ghost" size="icon" className="h-9 w-9 mx-auto" title="Editar Perfil">
                  <UserCog className="h-4 w-4" />
                </Button>
              } />
              <ModeToggle />
              <SidebarVersionIndicator />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
                  queryClient.invalidateQueries({ queryKey: ['user-role'] });
                  toast({ title: "Permissões atualizadas", description: "Cache recarregado." });
                }}
                className="h-9 w-9 mx-auto"
                title="Recarregar permissões"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-9 w-9 mx-auto"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
