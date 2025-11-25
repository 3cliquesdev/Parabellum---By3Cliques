import { useAvailabilityStatus } from "@/hooks/useAvailabilityStatus";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusConfig = {
  online: {
    label: "Online",
    icon: "🟢",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/20",
  },
  busy: {
    label: "Ocupado",
    icon: "🟡",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
  },
  offline: {
    label: "Offline",
    icon: "🔴",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
  },
} as const;

export function AvailabilityToggle() {
  const { status, isLoading, updateStatus } = useAvailabilityStatus();

  if (isLoading || !status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  const currentConfig = statusConfig[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`justify-start gap-2 ${currentConfig.bg} ${currentConfig.color} hover:${currentConfig.bg}`}
        >
          <span className="text-base">{currentConfig.icon}</span>
          <span className="font-medium">{currentConfig.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => updateStatus("online")}
          disabled={status === "online"}
          className="gap-2"
        >
          <span className="text-base">{statusConfig.online.icon}</span>
          <div className="flex flex-col">
            <span className="font-medium">{statusConfig.online.label}</span>
            <span className="text-xs text-muted-foreground">Recebe chats</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => updateStatus("busy")}
          disabled={status === "busy"}
          className="gap-2"
        >
          <span className="text-base">{statusConfig.busy.icon}</span>
          <div className="flex flex-col">
            <span className="font-medium">{statusConfig.busy.label}</span>
            <span className="text-xs text-muted-foreground">Não recebe novos</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => updateStatus("offline")}
          disabled={status === "offline"}
          className="gap-2"
        >
          <span className="text-base">{statusConfig.offline.icon}</span>
          <div className="flex flex-col">
            <span className="font-medium">{statusConfig.offline.label}</span>
            <span className="text-xs text-muted-foreground">Indisponível</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
