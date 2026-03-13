import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useProfilesRealtime } from "@/hooks/useProfilesRealtime";
import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";
import { useDealsRealtime } from "@/hooks/useDealsRealtime";
import { useRealtimeHealth } from "@/hooks/useRealtimeHealth";
import { GlobalTourButton } from "@/components/tour/GlobalTourButton";
import { NotificationBell } from "@/components/NotificationBell";
import { WifiOff, RefreshCw, Search, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { checkAndNotify } from "@/lib/build/ensureLatestBuild";
import { Input } from "@/components/ui/input";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/inbox": "Inbox",
  "/contacts": "Contatos",
  "/deals": "Negócios",
  "/support": "Suporte",
  "/analytics": "Analytics",
  "/organizations": "Organizações",
  "/settings": "Configurações",
  "/users": "Usuários",
  "/automations": "Automações",
  "/forms": "Formulários",
  "/email-templates": "Templates de Email",
  "/knowledge": "Knowledge Base",
  "/projects": "Projetos",
  "/quotes": "Orçamentos",
  "/subscriptions": "Assinaturas",
  "/sales-management": "Gestão de Vendas",
  "/cs-management": "Gestão de CS",
  "/my-portfolio": "Meu Portfólio",
  "/dashboards": "Dashboards",
  "/report-builder": "Report Builder",
  "/client-portal": "Portal do Cliente",
  "/cadences": "Cadências",
  "/setup-password": "Configurar Senha",
};

function getBreadcrumb(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["CRM", "Dashboard"];
  const base = "/" + segments[0];
  const label = routeLabels[base] || segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
  return ["CRM", label];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  useProfilesRealtime();
  useTicketsRealtime();
  useDealsRealtime();
  
  const { isConnected, forceReconnect } = useRealtimeHealth();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const breadcrumb = getBreadcrumb(location.pathname);

  useEffect(() => {
    checkAndNotify();
  }, [location.pathname]);

  useEffect(() => {
    const interval = setInterval(() => {
      checkAndNotify();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {/* Header Enterprise */}
          <header className="h-14 border-b-2 border-slate-200 dark:border-border flex items-center px-4 bg-card shadow-sm flex-shrink-0 gap-3">
            <SidebarTrigger className="text-foreground hover:bg-muted" />
            
            {/* Breadcrumb */}
            <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
              {breadcrumb.map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                  <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>
                    {item}
                  </span>
                </span>
              ))}
            </nav>

            {/* Indicador de conexão Realtime */}
            {!isConnected && (
              <button
                onClick={() => forceReconnect()}
                className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-md text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span>Reconectando...</span>
                <RefreshCw className="h-3 w-3 animate-spin" />
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Global Search */}
            <div className="hidden md:flex items-center max-w-xs w-full">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 rounded-lg bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            </div>

            {/* Notification Bell */}
            <NotificationBell />
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto min-w-0 max-w-full">
            {children}
          </main>
        </div>

        {/* Global Tutorial Button */}
        <GlobalTourButton />
      </div>
    </SidebarProvider>
  );
}
