import { useLocation } from "react-router-dom";
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
  CheckCircle2
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAvailabilityStatus } from "@/hooks/useAvailabilityStatus";
import { useNavigate } from "react-router-dom";
import { useSLAAlerts } from "@/hooks/useSLAAlerts";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/ModeToggle";
import ProfileEditDialog from "@/components/ProfileEditDialog";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";

// ============= SUPPORT AGENT MENU (🛡️) =============
const supportAgentMainItems = [
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
  { title: "Fila de Tickets", href: "/support", icon: Ticket },
];

const supportAgentToolsItems = [
  { title: "Base de Conhecimento", href: "/knowledge", icon: Book },
  { title: "Contatos", href: "/contacts", icon: Users },
];

// ============= SUPPORT MANAGER MENU (👨‍💼) =============
const supportManagerMainItems = [
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
  { title: "Fila de Tickets", href: "/support", icon: Ticket },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
];

const supportManagerToolsItems = [
  { title: "Base de Conhecimento", href: "/knowledge", icon: Book },
  { title: "Contatos", href: "/contacts", icon: Users },
];

// ============= FINANCIAL MANAGER MENU (💰) =============
const financialManagerMainItems = [
  { title: "Tickets Financeiros", href: "/support", icon: Ticket },
  { title: "Contatos", href: "/contacts", icon: Users },
];

// ============= CS MANAGER MENU (👔) =============
const csManagerMainItems = [
  { title: "Dashboard CS", href: "/cs-management", icon: BarChart3 },
  { title: "Carteiras", href: "/my-portfolio", icon: Briefcase },
];

const csManagerOperationItems = [
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
  { title: "Tickets", href: "/support", icon: Ticket },
  { title: "Clientes", href: "/contacts", icon: Users },
];

const csManagerAnalysisItems = [
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Relatórios", href: "/reports", icon: FileText },
  { title: "🎯 Definir Metas", href: "/goals-management", icon: Target },
];

// ============= CONSULTANT MENU (🤝) =============
const consultantMainItems = [
  { title: "Minha Carteira", href: "/my-portfolio", icon: Briefcase },
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
  { title: "Minhas Metas", href: "/goals", icon: Target },
];

const consultantClientItems = [
  { title: "Contatos", href: "/contacts", icon: Users },
  { title: "Tickets", href: "/support", icon: Headphones },
];

// ============= SALES REP MENU (🎯) =============
const salesRepMainItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
];

const salesRepSalesItems = [
  { title: "Negócios", href: "/deals", icon: DollarSign },
  { title: "Propostas", href: "/quotes", icon: Receipt },
  { title: "Contatos", href: "/contacts", icon: Users },
  { title: "Organizações", href: "/organizations", icon: Building2 },
];

const salesRepProductivityItems = [
  { title: "⚡ Workzone", href: "/sales-tasks", icon: CheckCircle2 },
  { title: "Cadências", href: "/cadences", icon: RefreshCw },
  { title: "Minhas Metas", href: "/goals", icon: Target },
];

// ============= ADMIN/MANAGER MENU (👑) =============
const adminOverviewItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
];

const adminOperationItems = [
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
  { title: "Tickets", href: "/support", icon: Headphones },
  { title: "Dashboard CS", href: "/cs-management", icon: BarChart3 },
  { title: "Negócios", href: "/deals", icon: TrendingUp },
  { title: "Propostas", href: "/quotes", icon: Receipt },
  { title: "Minha Carteira", href: "/my-portfolio", icon: Briefcase },
];

const adminCrmItems = [
  { title: "Contatos", href: "/contacts", icon: Users },
  { title: "Organizações", href: "/organizations", icon: Building2 },
];

  const adminStrategyItems = [
    { title: "Cadências", href: "/cadences", icon: RefreshCw },
    { title: "Automações", href: "/automations", icon: Zap },
    { title: "AI Studio", href: "/ai-studio/personas", icon: Brain },
    { title: "Templates de Email", href: "/email-templates", icon: Mail },
    { title: "Formulários", href: "/forms", icon: FileText },
    { title: "Playbooks de Onboarding", href: "/onboarding-builder", icon: Workflow },
    { title: "Execuções de Playbooks", href: "/playbook-executions", icon: CheckSquare },
  ];

const adminReportsItems = [
  { title: "Metas", href: "/goals", icon: Target },
  { title: "🎯 Definir Metas", href: "/goals-management", icon: Target },
  { title: "Relatórios", href: "/reports", icon: FileText },
];

const adminSystemItems = [
  { title: "Produtos", href: "/settings/products", icon: Package },
  { title: "Usuários", href: "/users", icon: UserCog },
  { title: "Importar Clientes", href: "/import-clients", icon: Upload },
  { title: "Configurações", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin, isManager, isSalesRep, isConsultant, isSupportAgent, isSupportManager, isFinancialManager, isCSManager, isGeneralManager, loading } = useUserRole();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status: availabilityStatus } = useAvailabilityStatus();
  const { data: slaAlerts = [] } = useSLAAlerts();

  // Determine mode label and color
  const getModeInfo = () => {
    if (isSupportManager && !isAdmin && !isManager && !isGeneralManager) return { label: "👨‍💼 Gerente de Suporte", color: "bg-indigo-500" };
    if (isSupportAgent && !isSupportManager && !isAdmin && !isManager && !isGeneralManager) return { label: "🛡️ Modo Suporte", color: "bg-blue-500" };
    if (isFinancialManager && !isAdmin && !isManager && !isGeneralManager) return { label: "💰 Gerente Financeiro", color: "bg-emerald-500" };
    if (isCSManager && !isAdmin && !isManager && !isGeneralManager) return { label: "👔 Gerente de CS", color: "bg-purple-600" };
    if (isConsultant && !isAdmin && !isManager && !isGeneralManager) return { label: "🤝 Modo Consultor", color: "bg-green-500" };
    if (isSalesRep && !isAdmin && !isManager && !isGeneralManager) return { label: "🎯 Modo Vendas", color: "bg-orange-500" };
    if (isGeneralManager && !isAdmin) return { label: "🎖️ Gerente Geral", color: "bg-blue-600" };
    if (isAdmin || isManager) return { label: "👑 Modo Admin", color: "bg-purple-500" };
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
    // Forçar recarregamento completo na tela de login para garantir limpeza de sessão
    window.location.href = "/auth";
  };

  const renderMenuItem = (item: { title: string; href: string; icon: any }) => {
    // Show SLA alert badge on Inbox for admins/managers/general_managers
    const showSLABadge = (isAdmin || isManager || isGeneralManager) && item.href === "/inbox" && slaAlerts.length > 0;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.href}
            end={item.href === "/"}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-700 dark:text-slate-300 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary hover:bg-primary/10 hover:text-primary"
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
              </span>
            )}
            {collapsed && showSLABadge && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] flex items-center justify-center text-white font-bold">
                {slaAlerts.length}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className={cn(
      collapsed ? "w-[60px]" : "w-[280px]",
      "bg-card border-r-2 border-slate-200 dark:border-border"
    )} collapsible="icon">
      {/* Header com Logo e Badge de Modo */}
      <SidebarHeader className="border-b-2 border-slate-200 dark:border-border p-4">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
                <span className="text-xl font-bold text-primary-foreground">C</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">CRM</h2>
                <p className="text-xs text-muted-foreground">Sistema de Vendas</p>
              </div>
            </div>
            <Badge variant="secondary" className="w-full justify-center text-xs font-medium">
              {modeInfo.label}
            </Badge>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary mx-auto">
              <span className="text-xl font-bold text-primary-foreground">C</span>
            </div>
            <div className={`h-1 w-8 rounded mx-auto ${modeInfo.color}`} />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Carregando menu...</div>
          </div>
        ) : (
          <>
            {/* ============= SUPPORT MANAGER VIEW (👨‍💼) ============= */}
            {isSupportManager && !isAdmin && !isManager ? (
              <>
                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Principal</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {supportManagerMainItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Equipe</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {supportManagerToolsItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : null}

            {/* ============= SUPPORT AGENT VIEW (🛡️) ============= */}
            {isSupportAgent && !isSupportManager && !isAdmin && !isManager ? (
              <>
                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Principal</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {supportAgentMainItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Ferramentas</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {supportAgentToolsItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : null}

            {/* ============= CS MANAGER VIEW (👔) ============= */}
            {isCSManager && !isAdmin && !isManager ? (
              <>
                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Gestão de CS</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {csManagerMainItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Operações</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {csManagerOperationItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Análise</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {csManagerAnalysisItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : null}

            {/* ============= FINANCIAL MANAGER VIEW (💰) ============= */}
            {isFinancialManager && !isAdmin && !isManager ? (
              <>
                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Financeiro</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {financialManagerMainItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : null}

            {/* ============= CONSULTANT VIEW (🤝) ============= */}
            {isConsultant && !isAdmin && !isManager ? (
              <>
                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Principal</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {consultantMainItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Clientes</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {consultantClientItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : null}

            {/* ============= SALES REP VIEW (🎯) ============= */}
            {isSalesRep && !isAdmin && !isManager && !isConsultant ? (
              <>
                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Principal</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {salesRepMainItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Vendas</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {salesRepSalesItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Produtividade</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {salesRepProductivityItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : null}

            {/* ============= ADMIN/MANAGER/GENERAL_MANAGER VIEW (👑/🎖️) ============= */}
            {isAdmin || isManager || isGeneralManager ? (
              <>
                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Visão Geral</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {adminOverviewItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Operação</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {adminOperationItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>CRM</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {adminCrmItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Estratégia</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {adminStrategyItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  {!collapsed && <SidebarGroupLabel>Relatórios</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {adminReportsItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                {isAdmin && (
                  <SidebarGroup>
                    {!collapsed && <SidebarGroupLabel>Sistema</SidebarGroupLabel>}
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {adminSystemItems.map(renderMenuItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                )}
              </>
            ) : null}
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
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {user?.email?.[0].toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {/* Status indicator dot */}
                {(isSupportAgent || isConsultant || isSalesRep) && !isAdmin && !isManager && (
                  <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-sidebar ${getStatusColor(availabilityStatus)}`} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.email?.split("@")[0] || "Usuário"}
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
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {user?.email?.[0].toUpperCase() || "U"}
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
