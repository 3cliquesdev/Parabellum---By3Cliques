import * as React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

interface PageContentProps {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex-shrink-0 p-4 md:p-6 lg:p-8 pb-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex-shrink-0 flex items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export function PageContent({ children, scrollable = true, className }: PageContentProps) {
  return (
    <div
      className={cn(
        "flex-1 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8",
        "min-w-0 max-w-full overflow-x-hidden",
        scrollable && "overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageFilters({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex-shrink-0 px-4 md:px-6 lg:px-8 pb-4 space-y-4", className)}>
      {children}
    </div>
  );
}
