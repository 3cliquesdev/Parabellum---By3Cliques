import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {/* Header Enterprise */}
          <header className="h-14 border-b-2 border-slate-200 dark:border-border flex items-center px-4 bg-card shadow-sm flex-shrink-0">
            <SidebarTrigger className="text-foreground hover:bg-muted" />
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto min-w-0 max-w-full">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
