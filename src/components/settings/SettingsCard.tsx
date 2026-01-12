import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  icon: LucideIcon;
  iconBgColor: string;
  title: string;
  description?: string;
  status?: "active" | "configured" | "pending" | "disabled";
  onClick: () => void;
  disabled?: boolean;
}

const statusConfig = {
  active: { label: "Ativo", className: "bg-green-500" },
  configured: { label: "Configurado", className: "bg-blue-500" },
  pending: { label: "Pendente", className: "bg-amber-500" },
  disabled: { label: "Desabilitado", className: "bg-muted-foreground" },
};

export function SettingsCard({
  icon: Icon,
  iconBgColor,
  title,
  description,
  status,
  onClick,
  disabled = false,
}: SettingsCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-3 p-4 rounded-xl border bg-card transition-all duration-200",
        "hover:shadow-md hover:border-primary/30 hover:bg-accent/50",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        disabled && "opacity-50 cursor-not-allowed hover:shadow-none hover:border-border hover:bg-card"
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          iconBgColor
        )}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>
      
      <div className="text-center space-y-1">
        <span className="font-medium text-sm text-foreground block">{title}</span>
        {description && (
          <span className="text-xs text-muted-foreground line-clamp-2">{description}</span>
        )}
      </div>

      {status && (
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", statusConfig[status].className)} />
          <span className="text-xs text-muted-foreground">{statusConfig[status].label}</span>
        </div>
      )}
    </button>
  );
}
