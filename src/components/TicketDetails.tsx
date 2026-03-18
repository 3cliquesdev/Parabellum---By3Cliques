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
import { TicketTimeline } from "@/components/TicketTimeline";
import { TicketTagsCard } from "@/components/TicketTagsCard";
import { RemovedAttachmentsHistory } from "@/components/RemovedAttachmentsHistory";
import { useTicketPresence } from "@/hooks/useTicketPresence";
import { ApprovalStatusBadge } from "@/components/ApprovalStatusBadge";
import { SLABadge } from "@/components/SLABadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Clock, CheckCircle, Sparkles, Copy, ArrowRight, Users, GitMerge, ExternalLink, User, FileText, Send, AlertTriangle, Tag } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUsers } from "@/hooks/useUsers";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useRequestApproval } from "@/hooks/useRequestApproval";
import { useActiveTicketStatuses } from "@/hooks/useTicketStatuses";
import { Link } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTicketFieldSettings } from "@/hooks/useTicketFieldSettings";
import { useTicketTags } from "@/hooks/useTicketTags";

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

const statusIcons: Record<string, React.ReactNode> = {
  open: <Clock className="w-4 h-4" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  waiting_customer: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  resolved: <CheckCircle className="w-4 h-4 text-green-500" />,
  closed: <CheckCircle className="w-4 h-4 text-muted-foreground" />,
  pending_approval: <Clock className="w-4 h-4 text-yellow-600" />,
  returned: <AlertCircle className="w-4 h-4 text-orange-500" />,
  loja_bloqueada: <AlertCircle className="w-4 h-4 text-red-500" />,
  loja_concluida: <CheckCircle className="w-4 h-4 text-green-500" />,
  approved: <CheckCircle className="w-4 h-4 text-blue-600" />,
};

const statusLabels: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em Análise',
  waiting_customer: 'Aguardando Cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
  pending_approval: 'Aguard. Aprovação',
  returned: 'Devolvido',
  loja_bloqueada: 'Loja Bloqueada',
  loja_concluida: 'Loja Concluída',
  approved: 'Aprovado',
};

export function TicketDetails({ ticket }: TicketDetailsProps) {
  const updateTicket = useUpdateTicket();
  const { data: users = [] } = useUsers();
  const { data: ticketStatuses = [] } = useActiveTicketStatuses();
  const smartReply = useSmartReply();
  const requestApproval = useRequestApproval();
  const { isFinancialManager, isFinancialAgent, isSupportAgent, isAdmin, isManager } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [suggestedReply, setSuggestedReply] = useState<string>("");
  const [attachments, setAttachments] = useState(ticket.attachments || []);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [showMissingTagsDialog, setShowMissingTagsDialog] = useState(false);
  
  // FASE 5: Agent Presence
  const { otherUsers, setTyping } = useTicketPresence(ticket.id);

  // Filtrar usuários que podem receber tickets (suporte + gestão + financeiro + consultores)
  const supportUsers = users.filter((user: any) => 
    ['support_agent', 'support_manager', 'admin', 'manager', 'general_manager', 'financial_manager', 'financial_agent', 'consultant', 'cs_manager'].includes(user.role)
  );

  const { settings: fieldSettings } = useTicketFieldSettings();
  const { data: ticketTagsData } = useTicketTags(ticket.id);

  const handleStatusChange = (status: string) => {
    if ((status === 'resolved' || status === 'closed') && fieldSettings.tags && (!ticketTagsData || ticketTagsData.length === 0)) {
      setShowMissingTagsDialog(true);
      return;
    }
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

  const handleAssignChange = async (userId: string) => {
    const assignTo = userId === 'unassigned' ? null : userId;
    try {
      const { data, error } = await supabase.rpc('assign_ticket_secure', {
        p_ticket_id: ticket.id,
        p_assigned_to: assignTo,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao atribuir ticket');
      }
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["ticket-counts"] });
      toast({ title: "Ticket atribuído com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao atribuir ticket", description: err.message, variant: "destructive" });
    }
  };

  const handleAttachmentsChange = (newAttachments: any[]) => {
    setAttachments(newAttachments);
    updateTicket.mutate({
      id: ticket.id,
      updates: { attachments: newAttachments },
    });
  };

  const handleRemoveAttachment = async (attachment: any, index: number) => {
    const newAttachments = attachments.filter((_: any, i: number) => i !== index);
    setAttachments(newAttachments);
    
    try {
      // Salvar no banco
      await updateTicket.mutateAsync({
        id: ticket.id,
        updates: { attachments: newAttachments },
      });
      
      // Registrar evento no histórico
      await supabase.functions.invoke('notify-ticket-event', {
        body: {
          ticket_id: ticket.id,
          event_type: 'attachment_removed',
          actor_id: user?.id,
          metadata: {
            file_name: attachment.name,
            file_type: attachment.type,
            file_url: attachment.url,
          }
        }
      });

      // Invalidar query de eventos para atualizar timeline
      queryClient.invalidateQueries({ queryKey: ["ticket-events", ticket.id] });
      
      toast({
        title: "Evidência removida",
        description: `Arquivo "${attachment.name}" foi removido e registrado no histórico.`,
      });
    } catch (error) {
      console.error('[TicketDetails] Error removing attachment:', error);
      // Reverter em caso de erro
      setAttachments(attachments);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover a evidência.",
        variant: "destructive",
      });
    }
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
  
  // Sistema de Aprovação Gerencial
  const isPendingApproval = ticket.status === 'pending_approval';
  const canRequestApproval = isFinancialAgent && isFinancialTicket && !isPendingApproval && ticket.status !== 'resolved' && ticket.status !== 'closed';
  const canApprove = (isFinancialManager || isAdmin) && isFinancialTicket;

  const handleRequestApproval = () => {
    requestApproval.mutate(ticket.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Alerta de Ticket Mesclado */}
      {ticket.merged_to_ticket_id && (
        <Alert className="m-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-yellow-800 dark:text-yellow-200">
              ⚠️ Este ticket foi mesclado no Ticket #{ticket.merged_to_ticket_number || ticket.merged_to_ticket_id.slice(0, 8)}.
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
      <div className="border-b p-4 space-y-3">
        {/* Linha 1: Protocolo + Canal + Presença + Ações */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
              #{ticket.ticket_number || ticket.id.slice(0, 8)}
            </Badge>
            <ChannelBadge channel={ticket.channel || 'platform'} />
            
            {/* FASE 5: Agent Presence - Avatares */}
            {otherUsers.length > 0 && (
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  <div className="flex -space-x-1.5">
                    {otherUsers.slice(0, 3).map((user) => (
                      <Tooltip key={user.user_id}>
                        <TooltipTrigger>
                          <Avatar className="w-6 h-6 border-2 border-background">
                            {user.avatar_url ? (
                              <AvatarImage src={user.avatar_url} alt={user.full_name} />
                            ) : null}
                            <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
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
                      +{otherUsers.length - 3}
                    </span>
                  )}
                </div>
              </TooltipProvider>
            )}
          </div>
          
          <div className="flex gap-1.5 items-center">
            {/* Badge de Status de Aprovação */}
            <ApprovalStatusBadge
              status={ticket.status}
              approvedBy={ticket.approved_by}
              approvedAt={ticket.approved_at}
              rejectionReason={ticket.rejection_reason}
              size="sm"
            />

            {/* Botão Solicitar Aprovação Gerencial (para financial_agent) */}
            {canRequestApproval && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRequestApproval}
                      disabled={requestApproval.isPending}
                      className="h-8 px-2 text-yellow-600 border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      {requestApproval.isPending ? "Enviando..." : "Solicitar Aprovação"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Enviar para aprovação gerencial antes de processar reembolso</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Botão Mesclar Ticket */}
            {!ticket.merged_to_ticket_id && (ticket.status === 'open' || ticket.status === 'in_progress') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMergeDialogOpen(true)}
                className="h-8 px-2"
              >
                <GitMerge className="w-4 h-4" />
              </Button>
            )}

            {/* Botão Transferir para Financeiro */}
            {canTransferToFinancial && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTransferDialogOpen(true)}
                className="h-8 px-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* FASE 5: Alerta de "Fulano está digitando..." */}
        {otherUsers.some(u => u.is_typing) && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Users className="w-3 h-3 animate-pulse" />
            <span>
              {otherUsers.filter(u => u.is_typing).map(u => u.full_name).join(', ')} está digitando...
            </span>
          </div>
        )}
        
        {/* Linha 2: Título (com truncagem) */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h2 className="text-base font-semibold text-foreground line-clamp-2 cursor-default">
                {ticket.subject}
              </h2>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              <p className="text-sm">{ticket.subject}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* SLA Alert Banner - Prominent display for overdue tickets */}
        {ticket.due_date && !['resolved', 'closed'].includes(ticket.status) && (
          <div className="flex items-center gap-3">
            <SLABadge 
              dueDate={ticket.due_date} 
              priority={ticket.priority as 'urgent' | 'high' | 'medium' | 'low'}
              size="lg"
              showIcon={true}
            />
            {new Date(ticket.due_date) < new Date() && (
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium animate-pulse">
                <AlertTriangle className="w-4 h-4" />
                <span>Ticket atrasado! Prazo expirado.</span>
              </div>
            )}
          </div>
        )}

        {/* Linha 3: Metadados compactos */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {ticket.created_by_user ? (
              <span>
                <span className="font-medium text-foreground">{ticket.created_by_user.full_name}</span>
              </span>
            ) : (
              <span>Cliente</span>
            )}
          </div>
          <span className="text-muted-foreground/50">•</span>
          <span>
            {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
          <span className="text-muted-foreground/50">•</span>
          <span>
            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>


        {/* Controles inline compactos */}
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select value={ticket.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-7 text-xs w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ticketStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.name}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Prioridade</span>
            <Select value={ticket.priority} onValueChange={handlePriorityChange}>
              <SelectTrigger className="h-7 text-xs w-[90px]">
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

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">Atribuído</span>
            <Select 
              value={ticket.assigned_to || 'unassigned'} 
              onValueChange={handleAssignChange}
            >
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Não atribuído</SelectItem>
                {supportUsers.map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email || 'Usuário sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operação */}
          {ticket.operation_id && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Operação</span>
              <Badge variant="outline" className="text-xs">
                {(ticket as any).operation?.name || ticket.operation_id.slice(0, 8)}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Descrição do Chamado - Área Principal Expandida */}
        {ticket.description && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Descrição do Chamado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => (
                      <span className="font-semibold text-foreground">{children}</span>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 leading-relaxed text-sm text-foreground/90">{children}</p>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" 
                         className="text-primary hover:underline">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {ticket.description}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags do Ticket - sempre editável, independente do status */}
        <TicketTagsCard 
          ticketId={ticket.id} 
          readonly={false}
        />

        {/* Financial Approval Bar (para gerentes: financial_manager, manager, admin) */}
        {canApprove && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
          <FinancialApprovalBar 
            ticketId={ticket.id}
            ticketStatus={ticket.status}
            hasEvidence={hasEvidence}
            ticketCategory={ticket.category}
            isAdminUser={isAdmin}
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
        {ticket.customer ? (
          <CustomerInfoCard customer={ticket.customer} />
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-4 h-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Sem cliente vinculado</p>
            </CardContent>
          </Card>
        )}

        {/* Attachments/Evidence Section */}
        <TicketAttachments
          attachments={attachments}
          onAttachmentsChange={handleAttachmentsChange}
          onRemoveAttachment={handleRemoveAttachment}
          readonly={ticket.status === 'resolved' || ticket.status === 'closed'}
          requireEvidence={isFinancialTicket}
        />

        {/* Removed Attachments History - Only visible to admin */}
        {isAdmin && <RemovedAttachmentsHistory ticketId={ticket.id} />}

        {/* Ticket Timeline/History */}
        <TicketTimeline ticketId={ticket.id} />
        
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

      {/* Dialog de Tags Obrigatórias */}
      <AlertDialog open={showMissingTagsDialog} onOpenChange={setShowMissingTagsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Tags Obrigatórias Não Adicionadas
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  A configuração do seu departamento exige que <strong>pelo menos uma tag</strong> seja adicionada antes de encerrar um ticket.
                </p>
                <p className="text-sm text-muted-foreground">
                  Tags ajudam a classificar e organizar tickets para análise futura.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowMissingTagsDialog(false);
                setTimeout(() => {
                  document.getElementById('ticket-tags-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
            >
              <Tag className="h-4 w-4 mr-2" />
              Adicionar Tags Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
