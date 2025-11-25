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
  Brain
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
import ProfileEditDialog from "@/components/ProfileEditDialog";

const mainItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Inbox", href: "/inbox", icon: Inbox },
];

const crmItems = [
  { title: "Contatos", href: "/contacts", icon: Users },
  { title: "Organizações", href: "/organizations", icon: Building2 },
  { title: "Negócios", href: "/deals", icon: TrendingUp },
];

const automationItems = [
  { title: "Automações", href: "/automations", icon: Zap },
  { title: "Templates de Email", href: "/email-templates", icon: Mail },
  { title: "AI Studio", href: "/ai-studio/personas", icon: Brain },
];

const reportItems = [
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Metas", href: "/goals", icon: Target },
];

const supportItems = [
  { title: "Tickets", href: "/support", icon: Headphones },
  { title: "Importar Clientes", href: "/import-clients", icon: Upload },
];

const formsItems = [
  { title: "Formulários", href: "/forms", icon: FileText },
];

const managementItems = [
  { title: "Usuários", href: "/users", icon: UserCog },
  { title: "Configurações", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin, isManager } = useUserRole();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  return (
    <Sidebar className={collapsed ? "w-[60px]" : "w-[280px]"} collapsible="icon">
      {/* Header com Logo */}
      <SidebarHeader className="border-b border-border p-4">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
              <span className="text-xl font-bold text-primary-foreground">C</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">CRM</h2>
              <p className="text-xs text-muted-foreground">Sistema de Vendas</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary mx-auto">
            <span className="text-xl font-bold text-primary-foreground">C</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Principal */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Principal</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* CRM */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>CRM</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {crmItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Automação - apenas admin/manager */}
        {(isAdmin || isManager) && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Automação</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {automationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Relatórios - apenas admin/manager */}
        {(isAdmin || isManager) && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Relatórios</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {reportItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Suporte - apenas admin/manager */}
        {(isAdmin || isManager) && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Suporte</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {supportItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Formulários */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Formulários</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {formsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Gestão - apenas admin */}
        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Gestão</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {managementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
