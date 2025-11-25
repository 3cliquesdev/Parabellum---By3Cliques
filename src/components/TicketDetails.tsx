import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateTicket } from "@/hooks/useUpdateTicket";
import { CustomerInfoCard } from "@/components/CustomerInfoCard";
import { TicketChat } from "@/components/TicketChat";
import { AlertCircle, Clock, CheckCircle, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUsers } from "@/hooks/useUsers";

interface TicketDetailsProps {
  ticket: any;
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

export function TicketDetails({ ticket }: TicketDetailsProps) {
  const updateTicket = useUpdateTicket();
  const { data: users = [] } = useUsers();

  const handleStatusChange = (status: string) => {
    updateTicket.mutate({
      id: ticket.id,
      updates: { status: status as any },
    });
  };

  const handlePriorityChange = (priority: string) => {
    updateTicket.mutate({
      id: ticket.id,
      updates: { priority: priority as any },
    });
  };

  const handleAssignChange = (userId: string) => {
    updateTicket.mutate({
      id: ticket.id,
      updates: { assigned_to: userId === 'unassigned' ? null : userId },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{ticket.subject}</h2>
            <p className="text-sm text-muted-foreground">
              Criado {formatDistanceToNow(new Date(ticket.created_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground">{ticket.description}</p>

        {/* Controles */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium mb-2 block">Status</label>
            <Select value={ticket.status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="in_progress">Em Análise</SelectItem>
                <SelectItem value="waiting_customer">Aguardando Cliente</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
                <SelectItem value="closed">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block">Prioridade</label>
            <Select value={ticket.priority} onValueChange={handlePriorityChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block">Atribuído a</label>
            <Select 
              value={ticket.assigned_to || 'unassigned'} 
              onValueChange={handleAssignChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Não atribuído</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <CustomerInfoCard customer={ticket.customer} />
        <TicketChat ticketId={ticket.id} />
      </div>
    </div>
  );
}
