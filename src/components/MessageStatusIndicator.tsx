import { Clock, Check, CheckCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageStatusIndicatorProps {
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  className?: string;
}

export function MessageStatusIndicator({ status, className }: MessageStatusIndicatorProps) {
  const iconClass = cn("w-3 h-3", className);

  switch (status) {
    case 'sending':
      return <Clock className={cn(iconClass, "text-muted-foreground animate-pulse")} aria-label="Enviando..." />;
    case 'sent':
      return <Check className={cn(iconClass, "text-muted-foreground")} aria-label="Enviado" />;
    case 'delivered':
      return <CheckCheck className={cn(iconClass, "text-primary")} aria-label="Entregue" />;
    case 'failed':
      return <AlertCircle className={cn(iconClass, "text-destructive")} aria-label="Falha no envio" />;
    default:
      return null;
  }
}
