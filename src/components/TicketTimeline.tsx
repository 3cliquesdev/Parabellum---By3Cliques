import { useTicketEvents, TicketEvent } from "@/hooks/useTicketEvents";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  PlusCircle, 
  UserCheck, 
  ArrowRightLeft, 
  AlertTriangle, 
  MessageSquare,
  GitMerge,
  Building2,
  Clock,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TicketTimelineProps {
  ticketId: string;
}

const statusLabels: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em Análise',
  waiting_customer: 'Aguardando Cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const eventConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  created: {
    icon: <PlusCircle className="h-4 w-4" />,
    label: 'Ticket criado',
    color: 'bg-green-500',
  },
  assigned: {
    icon: <UserCheck className="h-4 w-4" />,
    label: 'Ticket atribuído',
    color: 'bg-blue-500',
  },
  status_changed: {
    icon: <ArrowRightLeft className="h-4 w-4" />,
    label: 'Status alterado',
    color: 'bg-purple-500',
  },
  priority_changed: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Prioridade alterada',
    color: 'bg-orange-500',
  },
  comment_added: {
    icon: <MessageSquare className="h-4 w-4" />,
    label: 'Comentário adicionado',
    color: 'bg-cyan-500',
  },
  merged: {
    icon: <GitMerge className="h-4 w-4" />,
    label: 'Ticket mesclado',
    color: 'bg-yellow-500',
  },
  transferred: {
    icon: <Building2 className="h-4 w-4" />,
    label: 'Transferido',
    color: 'bg-indigo-500',
  },
};

function EventDescription({ event }: { event: TicketEvent }) {
  const actorName = event.actor?.full_name || 'Sistema';

  switch (event.event_type) {
    case 'created':
      return (
        <span>
          <strong>{actorName}</strong> criou este ticket
          {event.metadata?.priority && (
            <> com prioridade <Badge variant="outline" className="ml-1">{priorityLabels[event.metadata.priority] || event.metadata.priority}</Badge></>
          )}
        </span>
      );

    case 'assigned':
      if (!event.new_value) {
        return <span><strong>{actorName}</strong> removeu a atribuição do ticket</span>;
      }
      return <span><strong>{actorName}</strong> atribuiu o ticket a um agente</span>;

    case 'status_changed':
      return (
        <span>
          <strong>{actorName}</strong> alterou o status de{' '}
          <Badge variant="outline" className="mx-1">{statusLabels[event.old_value || ''] || event.old_value}</Badge>
          para
          <Badge variant="outline" className="ml-1">{statusLabels[event.new_value || ''] || event.new_value}</Badge>
        </span>
      );

    case 'priority_changed':
      return (
        <span>
          <strong>{actorName}</strong> alterou a prioridade de{' '}
          <Badge variant="outline" className="mx-1">{priorityLabels[event.old_value || ''] || event.old_value}</Badge>
          para
          <Badge variant="outline" className="ml-1">{priorityLabels[event.new_value || ''] || event.new_value}</Badge>
        </span>
      );

    case 'comment_added':
      const isInternal = event.metadata?.is_internal;
      return (
        <span>
          <strong>{actorName}</strong> adicionou um {isInternal ? 'comentário interno' : 'comentário'}
        </span>
      );

    case 'merged':
      return (
        <span>
          <strong>{actorName}</strong> mesclou este ticket no ticket{' '}
          <Badge variant="outline" className="ml-1">#{event.metadata?.merged_to_ticket_number || event.new_value?.slice(0, 8)}</Badge>
        </span>
      );

    case 'transferred':
      return <span><strong>{actorName}</strong> transferiu o ticket para outro departamento</span>;

    default:
      return <span><strong>{actorName}</strong> realizou uma ação</span>;
  }
}

export function TicketTimeline({ ticketId }: TicketTimelineProps) {
  const { data: events = [], isLoading } = useTicketEvents(ticketId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico do Ticket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico do Ticket ({events.length} eventos)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-4">
              {events.map((event) => {
                const config = eventConfig[event.event_type] || {
                  icon: <Clock className="h-4 w-4" />,
                  label: event.event_type,
                  color: 'bg-muted',
                };

                return (
                  <div key={event.id} className="flex gap-4 relative">
                    {/* Icon */}
                    <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-white ${config.color}`}>
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="text-sm">
                        <EventDescription event={event} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {event.actor && (
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={event.actor.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {event.actor.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
