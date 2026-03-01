import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useProfilesRealtime } from "@/hooks/useProfilesRealtime";
import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";
import { useDealsRealtime } from "@/hooks/useDealsRealtime";
import { useRealtimeHealth } from "@/hooks/useRealtimeHealth";
import { GlobalTourButton } from "@/components/tour/GlobalTourButton";
import { NotificationBell } from "@/components/NotificationBell";
import { WifiOff, RefreshCw } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  // Realtime global para toda a aplicação
  useProfilesRealtime();
  useTicketsRealtime();
  useDealsRealtime();
  
  // Monitoramento de saúde da conexão Realtime
  const { isConnected, forceReconnect } = useRealtimeHealth();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {/* Header Enterprise */}
          <header className="h-14 border-b-2 border-slate-200 dark:border-border flex items-center px-4 bg-card shadow-sm flex-shrink-0">
            <SidebarTrigger className="text-foreground hover:bg-muted" />
            
            {/* Indicador de conexão Realtime */}
            {!isConnected && (
              <button
                onClick={() => forceReconnect()}
                className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-md text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span>Reconectando...</span>
                <RefreshCw className="h-3 w-3 animate-spin" />
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

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
