import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateTicket } from "@/hooks/useUpdateTicket";
import { CustomerInfoCard } from "@/components/CustomerInfoCard";
import { TicketChat } from "@/components/TicketChat";
import { useSmartReply } from "@/hooks/useSmartReply";
import { Textarea } from "@/components/ui/textarea";
import { TicketAttachments } from "@/components/TicketAttachments";
import { TicketConversationLink } from "@/components/TicketConversationLink";
import { FinancialApprovalBar } from "@/components/FinancialApprovalBar";
import { TransferToFinancialDialog } from "@/components/TransferToFinancialDialog";
import { AlertCircle, Clock, CheckCircle, Sparkles, Copy, ArrowRight } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUsers } from "@/hooks/useUsers";
import { useUserRole } from "@/hooks/useUserRole";

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
  const smartReply = useSmartReply();
  const { isFinancialManager, isSupportAgent } = useUserRole();
  const [suggestedReply, setSuggestedReply] = useState<string>("");
  const [attachments, setAttachments] = useState(ticket.attachments || []);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

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

  const handleAttachmentsChange = (newAttachments: any[]) => {
    setAttachments(newAttachments);
    updateTicket.mutate({
      id: ticket.id,
      updates: { attachments: newAttachments },
    });
  };

  const handleSmartReply = () => {
    smartReply.mutate(
      { description: ticket.description, subject: ticket.subject },
      {
        onSuccess: (reply) => {
          setSuggestedReply(reply);
        }
      }
    );
  };

  const handleCopyReply = () => {
    navigator.clipboard.writeText(suggestedReply);
  };

  // Verificar se é ticket de reembolso/financeiro
  const isFinancialTicket = ticket.category === 'financeiro' || ticket.description?.toLowerCase().includes('reembolso');
  const hasEvidence = attachments.length > 0;
  const canTransferToFinancial = isSupportAgent && isFinancialTicket && ticket.status !== 'resolved' && ticket.status !== 'closed';

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
          
          {/* Botão Transferir para Financeiro */}
          {canTransferToFinancial && (
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(true)}
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Enviar para Financeiro
            </Button>
          )}
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
        {/* Financial Approval Bar (só para financial_manager) */}
        {isFinancialManager && isFinancialTicket && (
          <FinancialApprovalBar 
            ticketId={ticket.id}
            ticketStatus={ticket.status}
            hasEvidence={hasEvidence}
          />
        )}

        {/* Conversation Link */}
        {ticket.conversation_id && (
          <TicketConversationLink 
            conversationId={ticket.conversation_id}
            conversationChannel={ticket.channel}
            conversationCreatedAt={ticket.created_at}
          />
        )}

        {/* Customer Info */}
        {ticket.customer && <CustomerInfoCard customer={ticket.customer} />}

        {/* Attachments/Evidence Section */}
        <TicketAttachments
          attachments={attachments}
          onAttachmentsChange={handleAttachmentsChange}
          readonly={ticket.status === 'resolved' || ticket.status === 'closed'}
          requireEvidence={isFinancialTicket}
        />
        
        {/* Smart Reply Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Sugestão de Resposta AI
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSmartReply}
                disabled={smartReply.isPending}
              >
                {smartReply.isPending ? "Gerando..." : "✨ Sugerir Resposta"}
              </Button>
            </div>
          </CardHeader>
          {suggestedReply && (
            <CardContent>
              <div className="relative">
                <Textarea
                  value={suggestedReply}
                  onChange={(e) => setSuggestedReply(e.target.value)}
                  rows={6}
                  className="pr-10 bg-muted/50"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleCopyReply}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Revise e personalize a resposta antes de enviar ao cliente
              </p>
            </CardContent>
          )}
        </Card>

        {/* Ticket Chat */}
        <TicketChat ticketId={ticket.id} />
      </div>

      {/* Transfer Dialog */}
      <TransferToFinancialDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        ticketId={ticket.id}
        hasEvidence={hasEvidence}
      />
    </div>
  );
}
