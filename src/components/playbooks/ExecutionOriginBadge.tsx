import { Badge } from "@/components/ui/badge";
import { Bot, User, Package } from "lucide-react";

interface ExecutionOriginBadgeProps {
  triggeredBy?: string | null;
}

export function ExecutionOriginBadge({ triggeredBy }: ExecutionOriginBadgeProps) {
  switch (triggeredBy) {
    case "bulk":
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Package className="h-3 w-3" />
          Lote
        </Badge>
      );
    case "manual":
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <User className="h-3 w-3" />
          Manual
        </Badge>
      );
    case "automatic":
    default:
      return (
        <Badge variant="default" className="gap-1 text-xs bg-primary/80">
          <Bot className="h-3 w-3" />
          Automático
        </Badge>
      );
  }
}
