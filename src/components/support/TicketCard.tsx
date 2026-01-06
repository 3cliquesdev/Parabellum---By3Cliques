import { Badge } from "@/components/ui/badge";
import { ChevronRight, Clock, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveTicketStatuses } from "@/hooks/useTicketStatuses";
import { getStatusIcon } from "@/lib/ticketStatusIcons";

type Ticket = Tables<"tickets"> & {
  contacts?: Tables<"contacts"> | null;
  assigned_to_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
  isSelected?: boolean;
}

const priorityConfig = {
  low: { label: "Baixa", variant: "outline" as const },
  medium: { label: "Média", variant: "secondary" as const },
  high: { label: "Alta", variant: "destructive" as const },
  urgent: { label: "Urgente", variant: "destructive" as const },
};

// Fallback status config for when dynamic statuses are loading
const fallbackStatusConfig: Record<string, { label: string; color: string }> = {
  open: { label: "Aberto", color: "#3B82F6" },
  in_progress: { label: "Em Andamento", color: "#F97316" },
  waiting_customer: { label: "Aguardando Cliente", color: "#EAB308" },
  resolved: { label: "Resolvido", color: "#22C55E" },
  closed: { label: "Fechado", color: "#6B7280" },
};

export function TicketCard({ ticket, onClick, isSelected }: TicketCardProps) {
  const { data: statuses } = useActiveTicketStatuses();
  const priority = priorityConfig[ticket.priority as keyof typeof priorityConfig];
  
  // Find dynamic status or use fallback
  const dynamicStatus = statuses?.find(s => s.name === ticket.status);
  const statusLabel = dynamicStatus?.label || fallbackStatusConfig[ticket.status]?.label || ticket.status;
  const statusColor = dynamicStatus?.color || fallbackStatusConfig[ticket.status]?.color || "#6B7280";
  const StatusIcon = dynamicStatus ? getStatusIcon(dynamicStatus.icon) : null;

  return (
    <div
      className={`flex flex-col gap-2 p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
      onClick={onClick}
    >
      {/* Header: Protocolo + Status */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-muted-foreground">
          #{ticket.ticket_number || ticket.id.slice(0, 8)}
        </span>
        <Badge 
          className="text-white flex items-center gap-1"
          style={{ backgroundColor: statusColor }}
        >
          {StatusIcon && <StatusIcon className="h-3 w-3" />}
          {statusLabel}
        </Badge>
      </div>

      {/* Subject */}
      <p className="font-medium text-foreground line-clamp-2">{ticket.subject}</p>

      {/* Contact + Priority */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="h-3 w-3" />
        <span className="truncate">
          {ticket.contacts
            ? `${ticket.contacts.first_name} ${ticket.contacts.last_name}`
            : "Sem contato"}
        </span>
        {priority && (
          <Badge variant={priority.variant} className="ml-auto text-xs">
            {priority.label}
          </Badge>
        )}
      </div>

      {/* Footer: Time + Arrow */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(ticket.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}
