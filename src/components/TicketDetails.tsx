import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUpdateTicket } from "@/hooks/useUpdateTicket";
import { CustomerInfoCard } from "@/components/CustomerInfoCard";
import { TicketChat } from "@/components/TicketChat";
import { useSmartReply } from "@/hooks/useSmartReply";
import { Textarea } from "@/components/ui/textarea";
import { TicketAttachments } from "@/components/TicketAttachments";
import { TicketConversationLink } from "@/components/TicketConversationLink";
import { FinancialApprovalBar } from "@/components/FinancialApprovalBar";
import { TransferToFinancialDialog } from "@/components/TransferToFinancialDialog";
import { MergeTicketDialog } from "@/components/MergeTicketDialog";
import { ChannelBadge } from "@/components/ChannelBadge";
import { useTicketPresence } from "@/hooks/useTicketPresence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Clock, CheckCircle, Sparkles, Copy, ArrowRight, Users, GitMerge, ExternalLink } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUsers } from "@/hooks/useUsers";
import { useUserRole } from "@/hooks/useUserRole";
import { Link } from "react-router-dom";

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
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  
  // FASE 5: Agent Presence
  const { otherUsers, setTyping } = useTicketPresence(ticket.id);

  // Filtrar apenas usuários de suporte para atribuição de tickets
  const supportUsers = users.filter((user: any) => 
    ['support_agent', 'support_manager', 'admin', 'manager'].includes(user.role)
  );

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
      {/* Alerta de Ticket Mesclado */}
      {ticket.merged_to_ticket_id && (
        <Alert className="m-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-yellow-800 dark:text-yellow-200">
              ⚠️ Este ticket foi mesclado no Ticket #{ticket.merged_to_ticket_id.slice(0, 8)}.
            </span>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900"
            >
              <Link to={`/support?ticket=${ticket.merged_to_ticket_id}`}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ir para Ticket Principal
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="border-b p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{ticket.subject}</h2>
              
              {/* Badge de Canal */}
              <ChannelBadge channel={ticket.channel || 'platform'} />
              
              {/* FASE 5: Agent Presence - Avatares */}
              {otherUsers.length > 0 && (
                <TooltipProvider>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {otherUsers.slice(0, 3).map((user) => (
                        <Tooltip key={user.user_id}>
                          <TooltipTrigger>
                            <Avatar className="w-8 h-8 border-2 border-white dark:border-zinc-800">
                              {user.avatar_url ? (
                                <AvatarImage src={user.avatar_url} alt={user.full_name} />
                              ) : null}
                              <AvatarFallback className="bg-blue-500 text-white text-xs">
                                {user.full_name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{user.full_name} - Visualizando agora</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    {otherUsers.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{otherUsers.length - 3} mais
                      </span>
                    )}
                  </div>
                </TooltipProvider>
              )}
            </div>
            
            {/* FASE 5: Alerta de "Fulano está digitando..." */}
            {otherUsers.some(u => u.is_typing) && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-2">
                <Users className="w-4 h-4 animate-pulse" />
                <span>
                  {otherUsers.filter(u => u.is_typing).map(u => u.full_name).join(', ')} está digitando...
                </span>
              </div>
            )}
            
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Criado {formatDistanceToNow(new Date(ticket.created_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </p>
          </div>
          
          <div className="flex gap-2">
            {/* Botão Mesclar Ticket */}
            {!ticket.merged_to_ticket_id && (ticket.status === 'open' || ticket.status === 'in_progress') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMergeDialogOpen(true)}
              >
                <GitMerge className="w-4 h-4 mr-2" />
                Mesclar Ticket
              </Button>
            )}

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
        </div>

        <p className="text-slate-600 dark:text-slate-400">{ticket.description}</p>

        {/* Controles */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium mb-2 block text-slate-700 dark:text-slate-300">Status</label>
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
            <label className="text-xs font-medium mb-2 block text-slate-700 dark:text-slate-300">Prioridade</label>
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
            <label className="text-xs font-medium mb-2 block text-slate-700 dark:text-slate-300">Atribuído a</label>
            <Select 
              value={ticket.assigned_to || 'unassigned'} 
              onValueChange={handleAssignChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Não atribuído</SelectItem>
                {supportUsers.map((user: any) => (
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
        {ticket.source_conversation_id && (
          <TicketConversationLink 
            conversationId={ticket.source_conversation_id}
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
        <TicketChat ticketId={ticket.id} channel={ticket.channel} />
      </div>

      {/* Dialogs */}
      <TransferToFinancialDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        ticketId={ticket.id}
        hasEvidence={hasEvidence}
      />

      <MergeTicketDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        sourceTicketId={ticket.id}
        sourceTicketSubject={ticket.subject}
      />
    </div>
  );
}
