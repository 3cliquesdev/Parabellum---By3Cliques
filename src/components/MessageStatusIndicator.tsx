import { Send, Check, CheckCheck, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
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
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function MessageStatusIndicator({ status, className, errorDetail, onRetry, isRetrying }: MessageStatusIndicatorProps) {
  const iconClass = cn("w-3 h-3", className);

  switch (status) {
    case 'sending':
      return <Send className={cn(iconClass, "text-muted-foreground animate-pulse")} aria-label="Enviando..." />;
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
        <span className="inline-flex items-center gap-1.5">
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
          {onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
              disabled={isRetrying}
              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
              aria-label="Reenviar mensagem"
            >
              {isRetrying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Reenviar
            </button>
          )}
        </span>
      );
    }
    default:
      return null;
  }
}
