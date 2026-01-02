import { Badge } from "@/components/ui/badge";
import { ChevronRight, Clock, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

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

const statusConfig = {
  open: { label: "Aberto", className: "bg-blue-500" },
  in_progress: { label: "Em Andamento", className: "bg-orange-500" },
  waiting_customer: { label: "Aguardando Cliente", className: "bg-yellow-500" },
  resolved: { label: "Resolvido", className: "bg-green-500" },
  closed: { label: "Fechado", className: "bg-gray-500" },
};

export function TicketCard({ ticket, onClick, isSelected }: TicketCardProps) {
  const priority = priorityConfig[ticket.priority as keyof typeof priorityConfig];
  const status = statusConfig[ticket.status as keyof typeof statusConfig];

  return (
    <div
      className={`flex flex-col gap-2 p-4 hover:bg-muted/50 transition-colors ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
      onClick={onClick}
    >
      {/* Header: Protocolo + Status */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-muted-foreground">
          #{ticket.ticket_number || ticket.id.slice(0, 8)}
        </span>
        <Badge className={status?.className}>{status?.label}</Badge>
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
