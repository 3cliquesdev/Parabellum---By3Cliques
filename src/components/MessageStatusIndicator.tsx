import { Send, Check, CheckCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageStatusIndicatorProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  className?: string;
  errorDetail?: string;
}

export function MessageStatusIndicator({ status, className, errorDetail }: MessageStatusIndicatorProps) {
  const iconClass = cn("w-3 h-3", className);

  switch (status) {
    case 'sending':
      return <Clock className={cn(iconClass, "text-muted-foreground animate-pulse")} aria-label="Enviando..." />;
    case 'sent':
      return <Check className={cn(iconClass, "text-muted-foreground")} aria-label="Enviado" />;
    case 'delivered':
      return <CheckCheck className={cn(iconClass, "text-muted-foreground")} aria-label="Entregue" />;
    case 'read':
      return <CheckCheck className={cn(iconClass, "text-blue-500")} aria-label="Lido" />;
    case 'failed': {
      const icon = <AlertCircle className={cn(iconClass, "text-destructive")} aria-label="Falha no envio" />;
      const detail = errorDetail || "Falha no envio";
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">{icon}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[250px] text-xs">
              {detail}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    default:
      return null;
  }
}
