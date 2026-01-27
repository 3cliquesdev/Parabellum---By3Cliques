import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, Clock, User, Eye, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveTicketStatuses } from "@/hooks/useTicketStatuses";
import { getStatusIcon } from "@/lib/ticketStatusIcons";
import { SLABadge } from "@/components/SLABadge";
interface ViewingInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

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
  viewers?: ViewingInfo[];
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
  pending_approval: { label: "Aguard. Aprovação", color: "#CA8A04" },
  returned: { label: "Devolvido", color: "#F97316" },
  loja_bloqueada: { label: "Loja Bloqueada", color: "#EF4444" },
  loja_concluida: { label: "Loja Concluída", color: "#22C55E" },
  approved: { label: "Aprovado", color: "#2563EB" },
};

export function TicketCard({ ticket, onClick, isSelected, viewers = [] }: TicketCardProps) {
  const { data: statuses } = useActiveTicketStatuses();
  const priority = priorityConfig[ticket.priority as keyof typeof priorityConfig];
  
  // Find dynamic status or use fallback
  const dynamicStatus = statuses?.find(s => s.name === ticket.status);
  const statusLabel = dynamicStatus?.label || fallbackStatusConfig[ticket.status]?.label || ticket.status;
  const statusColor = dynamicStatus?.color || fallbackStatusConfig[ticket.status]?.color || "#6B7280";
  const StatusIcon = dynamicStatus ? getStatusIcon(dynamicStatus.icon) : null;

  // Check if SLA is expired (ticket not resolved/closed and past due date)
  const isOverdue = ticket.due_date && 
    !['resolved', 'closed'].includes(ticket.status) && 
    new Date(ticket.due_date) < new Date();

  return (
    <div
      className={`flex flex-col gap-2 p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
      } ${viewers.length > 0 ? "bg-primary/5" : ""} ${isOverdue ? "border-l-2 border-l-destructive bg-destructive/5" : ""}`}
      onClick={onClick}
    >
      {/* Header: Protocolo + Status + Viewers */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* SLA Alert Icon */}
          {isOverdue && (
            <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
          )}
          <span className="font-mono text-sm text-muted-foreground">
            #{ticket.ticket_number || ticket.id.slice(0, 8)}
          </span>
          {/* Viewers Badge */}
          {viewers.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10">
                    <Eye className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-medium text-primary">{viewers.length}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-medium mb-1">Visualizando:</p>
                  {viewers.map((v) => (
                    <p key={v.user_id} className="text-xs">{v.full_name}</p>
                  ))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Badge 
          className="text-white flex items-center gap-1"
          style={{ backgroundColor: statusColor }}
        >
          {StatusIcon && <StatusIcon className="h-3 w-3" />}
          {statusLabel}
        </Badge>
      </div>

      {/* SLA Badge - Prominent display for overdue tickets */}
      {ticket.due_date && !['resolved', 'closed'].includes(ticket.status) && (
        <SLABadge 
          dueDate={ticket.due_date} 
          priority={ticket.priority as 'urgent' | 'high' | 'medium' | 'low'}
          size="sm"
          showIcon={true}
        />
      )}

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
