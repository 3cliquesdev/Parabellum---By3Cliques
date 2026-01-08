import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/ModeToggle";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {/* Header Enterprise */}
          <header className="h-14 border-b border-border flex items-center px-4 bg-card shadow-sm flex-shrink-0">
            <SidebarTrigger className="text-foreground hover:bg-muted" />
            <div className="flex-1" />
            <ModeToggle />
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
