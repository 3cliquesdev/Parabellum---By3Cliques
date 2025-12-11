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
  CheckCircle2,
  Tags,
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

// ============= MENU ITEM TYPE =============
interface MenuItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: string; // Chave de permissão obrigatória
}

// ============= MENU GROUPS DEFINITION =============
interface MenuGroup {
  label: string;
  items: MenuItem[];
}

// ============= ALL MENU ITEMS WITH PERMISSIONS =============
const allMenuItems: MenuItem[] = [
  // Dashboard & Overview
  { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
  { title: "Gestão de Vendas", href: "/sales-management", icon: TrendingUp, permission: "sales.view_management" },
  { title: "Dashboard CS", href: "/cs-management", icon: BarChart3, permission: "cs.view_management" },
  { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
  
  // Inbox & Support
  { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
  { title: "Fila de Tickets", href: "/support", icon: Ticket, permission: "tickets.view" },
  { title: "Base de Conhecimento", href: "/knowledge", icon: Book, permission: "inbox.view_knowledge" },
  
  // Sales
  { title: "Negócios", href: "/deals", icon: DollarSign, permission: "deals.view" },
  { title: "Propostas", href: "/quotes", icon: Receipt, permission: "quotes.view" },
  { title: "⚡ Workzone", href: "/sales-tasks", icon: CheckCircle2, permission: "sales.view_workzone" },
  { title: "Cadências", href: "/cadences", icon: RefreshCw, permission: "cadences.manage" },
  
  // CS / Portfolio
  { title: "Minha Carteira", href: "/my-portfolio", icon: Briefcase, permission: "cs.view_own_portfolio" },
  
  // CRM
  { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
  { title: "Organizações", href: "/organizations", icon: Building2, permission: "contacts.view_organizations" },
  
  // Goals & Reports
  { title: "Minhas Metas", href: "/goals", icon: Target, permission: "goals.view_own" },
  { title: "🎯 Definir Metas", href: "/goals-management", icon: Target, permission: "goals.set" },
  { title: "Relatórios", href: "/reports", icon: FileText, permission: "analytics.export" },
  
  // Automations & AI
  { title: "Automações", href: "/automations", icon: Zap, permission: "automations.view" },
  { title: "AI Studio", href: "/ai-studio/personas", icon: Brain, permission: "ai.manage_personas" },
  { title: "🤖 AI Trainer", href: "/settings/ai-trainer", icon: Brain, permission: "ai.train" },
  
  // Email & Forms
  { title: "Templates de Email", href: "/email-templates", icon: Mail, permission: "email.view_templates" },
  { title: "Formulários", href: "/forms", icon: FileText, permission: "forms.view" },
  
  // Playbooks
  { title: "Playbooks de Onboarding", href: "/onboarding-builder", icon: Workflow, permission: "playbooks.view" },
  { title: "Execuções de Playbooks", href: "/playbook-executions", icon: CheckSquare, permission: "playbooks.view_executions" },
  
  // Cadastros
  { title: "Consultores", href: "/consultants", icon: Users, permission: "cadastros.view_consultants" },
  { title: "Tags", href: "/settings/tags", icon: Tags, permission: "cadastros.view_tags" },
  { title: "Produtos", href: "/settings/products", icon: Package, permission: "cadastros.view_products" },
  { title: "Departamentos", href: "/settings/departments", icon: Building2, permission: "cadastros.view_departments" },
  
  // System (admin only)
  { title: "Usuários", href: "/users", icon: UserCog, permission: "settings.manage_users" },
  { title: "Importar Clientes", href: "/import-clients", icon: Upload, permission: "contacts.import" },
  { title: "Configurações", href: "/settings", icon: Settings, permission: "settings.view" },
];

// ============= MENU STRUCTURE PER ROLE =============
// Define a estrutura de grupos de menu para cada role
// Cada item referencia a permission que será verificada dinamicamente

const menuStructure: Record<string, MenuGroup[]> = {
  // Support Agent
  support_agent: [
    {
      label: "Principal",
      items: [
        { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
        { title: "Fila de Tickets", href: "/support", icon: Ticket, permission: "tickets.view" },
      ]
    },
    {
      label: "Ferramentas",
      items: [
        { title: "Base de Conhecimento", href: "/knowledge", icon: Book, permission: "inbox.view_knowledge" },
        { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
      ]
    }
  ],
  
  // Support Manager
  support_manager: [
    {
      label: "Principal",
      items: [
        { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
        { title: "Fila de Tickets", href: "/support", icon: Ticket, permission: "tickets.view" },
        { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
      ]
    },
    {
      label: "Equipe",
      items: [
        { title: "Base de Conhecimento", href: "/knowledge", icon: Book, permission: "inbox.view_knowledge" },
        { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
        { title: "Tags", href: "/settings/tags", icon: Tags, permission: "cadastros.view_tags" },
      ]
    },
    {
      label: "Gestão",
      items: [
        { title: "Relatórios", href: "/reports", icon: FileText, permission: "analytics.export" },
        { title: "🎯 Definir Metas", href: "/goals-management", icon: Target, permission: "goals.set" },
      ]
    },
    {
      label: "📦 Cadastros",
      items: [
        { title: "Produtos", href: "/settings/products", icon: Package, permission: "cadastros.view_products" },
      ]
    }
  ],
  
  // Financial Manager
  financial_manager: [
    {
      label: "Visão Geral",
      items: [
        { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
        { title: "Relatórios", href: "/reports", icon: FileText, permission: "analytics.export" },
      ]
    },
    {
      label: "Operações Financeiras",
      items: [
        { title: "Tickets Financeiros", href: "/support", icon: Ticket, permission: "tickets.view" },
        { title: "Cotações", href: "/quotes", icon: Receipt, permission: "quotes.view" },
        { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
      ]
    },
    {
      label: "Cadastros",
      items: [
        { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
      ]
    }
  ],
  
  // CS Manager
  cs_manager: [
    {
      label: "Gestão de CS",
      items: [
        { title: "Dashboard CS", href: "/cs-management", icon: BarChart3, permission: "cs.view_management" },
        { title: "Carteiras", href: "/my-portfolio", icon: Briefcase, permission: "cs.view_own_portfolio" },
      ]
    },
    {
      label: "Onboarding",
      items: [
        { title: "Playbooks", href: "/onboarding-builder", icon: Workflow, permission: "playbooks.view" },
        { title: "Execuções", href: "/playbook-executions", icon: CheckSquare, permission: "playbooks.view_executions" },
      ]
    },
    {
      label: "Operações",
      items: [
        { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
        { title: "Tickets", href: "/support", icon: Ticket, permission: "tickets.view" },
        { title: "Clientes", href: "/contacts", icon: Users, permission: "contacts.view" },
      ]
    },
    {
      label: "Análise",
      items: [
        { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
        { title: "Relatórios", href: "/reports", icon: FileText, permission: "analytics.export" },
        { title: "🎯 Definir Metas", href: "/goals-management", icon: Target, permission: "goals.set" },
      ]
    }
  ],
  
  // Consultant
  consultant: [
    {
      label: "Principal",
      items: [
        { title: "Minha Carteira", href: "/my-portfolio", icon: Briefcase, permission: "cs.view_own_portfolio" },
        { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
        { title: "Minhas Metas", href: "/goals", icon: Target, permission: "goals.view_own" },
      ]
    },
    {
      label: "Clientes",
      items: [
        { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
        { title: "Tickets", href: "/support", icon: Headphones, permission: "tickets.view" },
      ]
    }
  ],
  
  // Sales Rep
  sales_rep: [
    {
      label: "Principal",
      items: [
        { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
        { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
      ]
    },
    {
      label: "Vendas",
      items: [
        { title: "Negócios", href: "/deals", icon: DollarSign, permission: "deals.view" },
        { title: "Propostas", href: "/quotes", icon: Receipt, permission: "quotes.view" },
        { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
        { title: "Organizações", href: "/organizations", icon: Building2, permission: "contacts.view_organizations" },
      ]
    },
    {
      label: "Produtividade",
      items: [
        { title: "⚡ Workzone", href: "/sales-tasks", icon: CheckCircle2, permission: "sales.view_workzone" },
        { title: "Cadências", href: "/cadences", icon: RefreshCw, permission: "cadences.manage" },
        { title: "Minhas Metas", href: "/goals", icon: Target, permission: "goals.view_own" },
      ]
    }
  ],
  
  // Sales Manager
  manager: [
    {
      label: "Visão Geral",
      items: [
        { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
        { title: "Gestão de Vendas", href: "/sales-management", icon: TrendingUp, permission: "sales.view_management" },
        { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
      ]
    },
    {
      label: "Vendas",
      items: [
        { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
        { title: "Negócios", href: "/deals", icon: TrendingUp, permission: "deals.view" },
        { title: "Propostas", href: "/quotes", icon: Receipt, permission: "quotes.view" },
        { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
        { title: "Organizações", href: "/organizations", icon: Building2, permission: "contacts.view_organizations" },
      ]
    },
    {
      label: "Gestão",
      items: [
        { title: "Cadências", href: "/cadences", icon: RefreshCw, permission: "cadences.manage" },
        { title: "Metas da Equipe", href: "/goals", icon: Target, permission: "goals.view_own" },
        { title: "🎯 Definir Metas", href: "/goals-management", icon: Target, permission: "goals.set" },
        { title: "Relatórios", href: "/reports", icon: FileText, permission: "analytics.export" },
      ]
    },
    {
      label: "📦 Cadastros",
      items: [
        { title: "Produtos", href: "/settings/products", icon: Package, permission: "cadastros.view_products" },
      ]
    }
  ],
  
  // Admin / General Manager
  admin: [
    {
      label: "Visão Geral",
      items: [
        { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
        { title: "Gestão de Vendas", href: "/sales-management", icon: TrendingUp, permission: "sales.view_management" },
        { title: "Dashboard CS", href: "/cs-management", icon: BarChart3, permission: "cs.view_management" },
        { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
      ]
    },
    {
      label: "Operação",
      items: [
        { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
        { title: "Tickets", href: "/support", icon: Headphones, permission: "tickets.view" },
        { title: "Negócios", href: "/deals", icon: TrendingUp, permission: "deals.view" },
        { title: "Propostas", href: "/quotes", icon: Receipt, permission: "quotes.view" },
        { title: "Minha Carteira", href: "/my-portfolio", icon: Briefcase, permission: "cs.view_own_portfolio" },
      ]
    },
    {
      label: "CRM",
      items: [
        { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
        { title: "Organizações", href: "/organizations", icon: Building2, permission: "contacts.view_organizations" },
        { title: "Base de Conhecimento", href: "/knowledge", icon: Book, permission: "inbox.view_knowledge" },
      ]
    },
    {
      label: "Estratégia",
      items: [
        { title: "Cadências", href: "/cadences", icon: RefreshCw, permission: "cadences.manage" },
        { title: "Automações", href: "/automations", icon: Zap, permission: "automations.view" },
        { title: "AI Studio", href: "/ai-studio/personas", icon: Brain, permission: "ai.manage_personas" },
        { title: "🤖 AI Trainer", href: "/settings/ai-trainer", icon: Brain, permission: "ai.train" },
        { title: "Templates de Email", href: "/email-templates", icon: Mail, permission: "email.view_templates" },
        { title: "Formulários", href: "/forms", icon: FileText, permission: "forms.view" },
        { title: "Playbooks de Onboarding", href: "/onboarding-builder", icon: Workflow, permission: "playbooks.view" },
        { title: "Execuções de Playbooks", href: "/playbook-executions", icon: CheckSquare, permission: "playbooks.view_executions" },
      ]
    },
    {
      label: "Relatórios",
      items: [
        { title: "Metas", href: "/goals", icon: Target, permission: "goals.view_own" },
        { title: "🎯 Definir Metas", href: "/goals-management", icon: Target, permission: "goals.set" },
        { title: "Relatórios", href: "/reports", icon: FileText, permission: "analytics.export" },
      ]
    },
    {
      label: "📦 Cadastros",
      items: [
        { title: "Consultores", href: "/consultants", icon: Users, permission: "cadastros.view_consultants" },
        { title: "Tags", href: "/settings/tags", icon: Tags, permission: "cadastros.view_tags" },
        { title: "Produtos", href: "/settings/products", icon: Package, permission: "cadastros.view_products" },
        { title: "Departamentos", href: "/settings/departments", icon: Building2, permission: "cadastros.view_departments" },
      ]
    },
    {
      label: "⚙️ Sistema",
      items: [
        { title: "Usuários", href: "/users", icon: UserCog, permission: "settings.manage_users" },
        { title: "Importar Clientes", href: "/import-clients", icon: Upload, permission: "contacts.import" },
        { title: "Configurações", href: "/settings", icon: Settings, permission: "settings.view" },
      ]
    }
  ],
};

// Alias para general_manager usar o mesmo menu de admin
menuStructure.general_manager = menuStructure.admin;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role, isAdmin, isManager, isSalesRep, isConsultant, isSupportAgent, isSupportManager, isFinancialManager, isCSManager, isGeneralManager, loading } = useUserRole();
  const { hasPermission } = useRolePermissions();
  useRealtimePermissions(); // Sincronização em tempo real
  const { signOut, user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status: availabilityStatus } = useAvailabilityStatus();
  const { data: slaAlerts = [] } = useSLAAlerts();
  const { theme } = useTheme();

  // Determine which menu structure to use based on role
  const getMenuStructure = (): MenuGroup[] => {
    if (!role) return [];
    
    // Map role to menu structure key
    const roleKey = role as string;
    
    // Return the structure for the role, or empty array if not found
    return menuStructure[roleKey] || [];
  };

  // Determine mode label and color
  const getModeInfo = () => {
    if (isSupportManager && !isAdmin && !isManager && !isGeneralManager) return { label: "👨‍💼 Gerente de Suporte", color: "bg-indigo-500" };
    if (isSupportAgent && !isSupportManager && !isAdmin && !isManager && !isGeneralManager) return { label: "🛡️ Modo Suporte", color: "bg-blue-500" };
    if (isFinancialManager && !isAdmin && !isManager && !isGeneralManager) return { label: "💰 Gerente Financeiro", color: "bg-emerald-500" };
    if (isCSManager && !isAdmin && !isManager && !isGeneralManager) return { label: "👔 Gerente de CS", color: "bg-purple-600" };
    if (isConsultant && !isAdmin && !isManager && !isGeneralManager) return { label: "🤝 Modo Consultor", color: "bg-green-500" };
    if (isSalesRep && !isAdmin && !isManager && !isGeneralManager) return { label: "🎯 Modo Vendas", color: "bg-orange-500" };
    if (isManager && !isAdmin && !isGeneralManager) return { label: "📊 Gerente de Vendas", color: "bg-blue-600" };
    if (isGeneralManager && !isAdmin) return { label: "🎖️ Gerente Geral", color: "bg-blue-600" };
    if (isAdmin) return { label: "👑 Modo Admin", color: "bg-purple-500" };
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

  // Filter menu items based on permissions
  const filterItemsByPermission = (items: MenuItem[]): MenuItem[] => {
    return items.filter(item => hasPermission(item.permission));
  };

  // Render a single menu item
  const renderMenuItem = (item: MenuItem) => {
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

  // Get filtered menu structure
  const menuGroups = getMenuStructure();

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
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Carregando menu...</div>
          </div>
        ) : (
          <>
            {/* Render all menu groups dynamically based on permissions */}
            {menuGroups.map((group) => {
              // Filter items by permission
              const filteredItems = filterItemsByPermission(group.items);
              
              // Only render group if it has visible items
              if (filteredItems.length === 0) return null;
              
              return (
                <SidebarGroup key={group.label}>
                  {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredItems.map(renderMenuItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
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
