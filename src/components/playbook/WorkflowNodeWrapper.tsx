import { ReactNode } from "react";
import { Handle, Position } from "reactflow";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowNodeWrapperProps {
  type: 'email' | 'delay' | 'task' | 'call' | 'condition' | 'approval' | 'form' | 'switch';
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  selected?: boolean;
  children?: ReactNode;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
  customHandles?: ReactNode;
  hasError?: boolean;
}

const typeColors: Record<string, { header: string; border: string }> = {
  email: {
    header: 'bg-blue-600 dark:bg-blue-700',
    border: 'border-blue-400 dark:border-blue-600',
  },
  delay: {
    header: 'bg-amber-600 dark:bg-amber-700',
    border: 'border-amber-400 dark:border-amber-600',
  },
  task: {
    header: 'bg-emerald-600 dark:bg-emerald-700',
    border: 'border-emerald-400 dark:border-emerald-600',
  },
  call: {
    header: 'bg-violet-600 dark:bg-violet-700',
    border: 'border-violet-400 dark:border-violet-600',
  },
  condition: {
    header: 'bg-purple-600 dark:bg-purple-700',
    border: 'border-purple-400 dark:border-purple-600',
  },
  approval: {
    header: 'bg-orange-600 dark:bg-orange-700',
    border: 'border-orange-400 dark:border-orange-600',
  },
  form: {
    header: 'bg-cyan-600 dark:bg-cyan-700',
    border: 'border-cyan-400 dark:border-cyan-600',
  },
  switch: {
    header: 'bg-pink-600 dark:bg-pink-700',
    border: 'border-pink-400 dark:border-pink-600',
  },
};

export function WorkflowNodeWrapper({
  type,
  icon: Icon,
  title,
  subtitle,
  selected = false,
  children,
  showTargetHandle = true,
  showSourceHandle = true,
  customHandles,
  hasError = false,
}: WorkflowNodeWrapperProps) {
  const colors = typeColors[type];

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden shadow-lg min-w-[240px] bg-card",
        "border-2 transition-all duration-200",
        selected ? "ring-2 ring-primary ring-offset-2 scale-105" : "",
        hasError ? "border-destructive" : colors.border
      )}
    >
      {/* Header Colorido */}
      <div className={cn("px-3 py-2 flex items-center gap-2", colors.header)}>
        <Icon className="h-4 w-4 text-white flex-shrink-0" />
        <span className="font-semibold text-white text-sm truncate">{title}</span>
      </div>

      {/* Corpo */}
      <div className="p-3 space-y-2">
        {subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
        )}
        {children}
      </div>

      {/* Handles */}
      {customHandles ? (
        customHandles
      ) : (
        <>
          {showTargetHandle && (
            <Handle
              type="target"
              position={Position.Left}
              className="!w-4 !h-4 !bg-primary !border-2 !border-background"
            />
          )}
          {showSourceHandle && (
            <Handle
              type="source"
              position={Position.Right}
              className="!w-4 !h-4 !bg-primary !border-2 !border-background"
            />
          )}
        </>
      )}
    </div>
  );
}
