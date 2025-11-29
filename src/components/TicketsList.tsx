import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Clock, CheckCircle } from "lucide-react";
import { SLABadge } from "./SLABadge";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  created_at: string;
  due_date: string | null;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
  } | null;
  assigned_user?: {
    full_name: string;
    avatar_url?: string;
  } | null;
}

interface TicketsListProps {
  tickets: Ticket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
}

const priorityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

const priorityLabels = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const statusIcons = {
  open: <Clock className="w-4 h-4" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  waiting_customer: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  resolved: <CheckCircle className="w-4 h-4 text-green-500" />,
  closed: <CheckCircle className="w-4 h-4 text-muted-foreground" />,
};

const statusLabels = {
  open: 'Aberto',
  in_progress: 'Em Análise',
  waiting_customer: 'Aguardando Cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

export function TicketsList({ tickets, selectedTicketId, onSelectTicket }: TicketsListProps) {
  if (tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <p className="text-muted-foreground">Nenhum ticket encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => onSelectTicket(ticket.id)}
            className={`p-4 cursor-pointer transition-colors hover:bg-accent ${
              selectedTicketId === ticket.id ? 'bg-accent border-l-4 border-primary' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={ticket.customer?.avatar_url} />
                <AvatarFallback>
                  {ticket.customer?.first_name?.[0]}{ticket.customer?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm truncate text-slate-900 dark:text-white">
                    {ticket.customer?.first_name || 'Cliente'} {ticket.customer?.last_name || ''}
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(ticket.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>

                <h4 className="font-semibold text-sm mb-1 truncate text-slate-900 dark:text-white">{ticket.subject}</h4>
                
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                  {ticket.description}
                </p>

                {/* SLA Visual Alert */}
                <div className="mb-2">
                  <SLABadge 
                    dueDate={ticket.due_date} 
                    priority={ticket.priority}
                    size="sm"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    {statusIcons[ticket.status]}
                    {statusLabels[ticket.status]}
                  </Badge>

                  {ticket.assigned_user && (
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      → {ticket.assigned_user.full_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
