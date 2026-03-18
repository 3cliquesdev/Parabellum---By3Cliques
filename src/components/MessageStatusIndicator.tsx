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
      const detail = errorDetail || "Falha no envio";
      return (
        <div className="flex items-center gap-2 mt-0.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 cursor-help">
                  <AlertCircle className={cn("w-3.5 h-3.5", className || "text-destructive")} aria-label="Falha no envio" />
                  <span className={cn("text-[11px] font-medium", className || "text-destructive")}>Falha</span>
                </span>
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
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors disabled:opacity-50",
                className
                  ? "bg-white/20 hover:bg-white/30 text-white"
                  : "bg-destructive/10 hover:bg-destructive/20 text-destructive"
              )}
              aria-label="Reenviar mensagem"
            >
              {isRetrying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Reenviar
            </button>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}
