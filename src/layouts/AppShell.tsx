import * as React from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}

/**
 * AppShell Enterprise - Layout consistente para todas as páginas
 * 
 * Uso:
 * <AppShell 
 *   title="Dashboard" 
 *   description="Visão geral do sistema"
 *   actions={<Button>Nova ação</Button>}
 *   sidebar={<AppSidebar />}
 * >
 *   {children}
 * </AppShell>
 */
export function AppShell({ 
  title, 
  description, 
  children, 
  actions,
  sidebar,
  className 
}: AppShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {sidebar}
      
      <main className={cn("flex-1 flex flex-col overflow-hidden", className)}>
        <header className="flex-shrink-0 flex items-center justify-between px-8 py-6 border-b border-border bg-card">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{title}</h1>
            {description && (
              <p className="text-muted-foreground text-sm mt-1">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>
          )}
        </header>
        
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * PageHeader - Header padrão para páginas sem AppShell completo
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold truncate">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}

/**
 * PageContainer - Container padrão para conteúdo de páginas
 */
interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("p-8", className)}>
      {children}
    </div>
  );
}
