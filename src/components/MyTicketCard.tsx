import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Clock, ChevronRight } from "lucide-react";

interface CustomerTicket {
  id: string;
  ticket_number: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  department: { id: string; name: string } | null;
  comment_count: number;
}

interface MyTicketCardProps {
  ticket: CustomerTicket;
  onClick: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Aberto", variant: "default" },
  in_progress: { label: "Em Andamento", variant: "secondary" },
  pending: { label: "Pendente", variant: "outline" },
  resolved: { label: "Resolvido", variant: "secondary" },
  closed: { label: "Fechado", variant: "outline" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Baixa", className: "text-muted-foreground" },
  medium: { label: "Média", className: "text-foreground" },
  high: { label: "Alta", className: "text-orange-500" },
  urgent: { label: "Urgente", className: "text-destructive font-medium" },
};

export default function MyTicketCard({ ticket, onClick }: MyTicketCardProps) {
  const status = statusConfig[ticket.status] || statusConfig.open;
  const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
  const ticketNumber = ticket.ticket_number || ticket.id.substring(0, 8).toUpperCase();

  return (
    <Card 
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">
                #{ticketNumber}
              </span>
              <Badge variant={status.variant} className="text-xs">
                {status.label}
              </Badge>
              <span className={`text-xs ${priority.className}`}>
                {priority.label}
              </span>
            </div>

            {/* Subject */}
            <h3 className="font-medium text-sm line-clamp-1 mb-1">
              {ticket.subject}
            </h3>

            {/* Description preview */}
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {ticket.description}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(ticket.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </div>
              {ticket.comment_count > 0 && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {ticket.comment_count} {ticket.comment_count === 1 ? 'resposta' : 'respostas'}
                </div>
              )}
              {ticket.department && (
                <span className="text-muted-foreground/70">
                  {ticket.department.name}
                </span>
              )}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
