import { useLocation } from "react-router-dom";
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
  Workflow
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
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
import ProfileEditDialog from "@/components/ProfileEditDialog";

// ============= SUPPORT AGENT MENU (🛡️) =============
const supportAgentMainItems = [
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
  { title: "Fila de Tickets", href: "/support", icon: Ticket },
];

const supportAgentToolsItems = [
  { title: "Base de Conhecimento", href: "/knowledge", icon: Book },
  { title: "Contatos", href: "/contacts", icon: Users },
];

// ============= CONSULTANT MENU (🤝) =============
const consultantMainItems = [
  { title: "Minha Carteira", href: "/my-portfolio", icon: Briefcase },
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
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
  { title: "Contatos", href: "/contacts", icon: Users },
  { title: "Organizações", href: "/organizations", icon: Building2 },
];

const salesRepMetricsItems = [
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
  { title: "Negócios", href: "/deals", icon: TrendingUp },
  { title: "Minha Carteira", href: "/my-portfolio", icon: Briefcase },
];

const adminCrmItems = [
  { title: "Contatos", href: "/contacts", icon: Users },
  { title: "Organizações", href: "/organizations", icon: Building2 },
];

  const adminStrategyItems = [
    { title: "Automações", href: "/automations", icon: Zap },
    { title: "AI Studio", href: "/ai-studio/personas", icon: Brain },
    { title: "Templates de Email", href: "/email-templates", icon: Mail },
    { title: "Formulários", href: "/forms", icon: FileText },
    { title: "Playbooks de Onboarding", href: "/onboarding-builder", icon: Workflow },
    { title: "Execuções de Playbooks", href: "/playbook-executions", icon: CheckSquare },
  ];

const adminReportsItems = [
  { title: "Metas", href: "/goals", icon: Target },
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
  const { isAdmin, isManager, isSalesRep, isConsultant, isSupportAgent, loading } = useUserRole();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Determine mode label and color
  const getModeInfo = () => {
    if (isSupportAgent) return { label: "🛡️ Modo Suporte", color: "bg-blue-500" };
    if (isConsultant && !isAdmin && !isManager) return { label: "🤝 Modo Consultor", color: "bg-green-500" };
    if (isSalesRep && !isAdmin && !isManager) return { label: "🎯 Modo Vendas", color: "bg-orange-500" };
    if (isAdmin || isManager) return { label: "👑 Modo Admin", color: "bg-purple-500" };
    return { label: "Sistema", color: "bg-gray-500" };
  };

  const modeInfo = getModeInfo();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  const renderMenuItem = (item: { title: string; href: string; icon: any }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.href}
          end={item.href === "/"}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar className={collapsed ? "w-[60px]" : "w-[280px]"} collapsible="icon">
      {/* Header com Logo e Badge de Modo */}
      <SidebarHeader className="border-b border-border p-4">
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
            {/* ============= SUPPORT AGENT VIEW (🛡️) ============= */}
            {isSupportAgent && !isAdmin && !isManager ? (
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
                  {!collapsed && <SidebarGroupLabel>Métricas</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {salesRepMetricsItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : null}

            {/* ============= ADMIN/MANAGER VIEW (👑) ============= */}
            {isAdmin || isManager ? (
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
            <div className="flex items-center gap-3 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.email?.substring(0, 2).toUpperCase() || "US"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Usuário</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <ProfileEditDialog
                trigger={
                  <Button variant="ghost" size="sm" className="flex-1 gap-2">
                    <Settings className="h-4 w-4" />
                    Perfil
                  </Button>
                }
              />
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="flex-1 gap-2">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ProfileEditDialog
              trigger={
                <Button variant="ghost" size="sm" className="w-full">
                  <Settings className="h-4 w-4" />
                </Button>
              }
            />
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
