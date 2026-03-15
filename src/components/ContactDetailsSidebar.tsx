import { useState } from "react";
import { displayName } from "@/lib/displayName";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Phone, Building2, Plus, Clock, AlertCircle, TrendingUp, Ticket, MessageSquare, ExternalLink, Loader2, AlertTriangle, ChevronRight, Pencil, Trophy, XCircle, ArrowRightLeft, MoreHorizontal, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContactTagsSection from "./inbox/ContactTagsSection";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useContactTickets } from "@/hooks/useContactTickets";
import { useUnifiedTimeline } from "@/hooks/useUnifiedTimeline";
import DealDialog from "./DealDialog";
import LostReasonDialog from "./LostReasonDialog";
import { SLABadge } from "./SLABadge";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveTicketStatuses } from "@/hooks/useTicketStatuses";
import { getStatusIcon } from "@/lib/ticketStatusIcons";
import { useUpdateDeal, useUpdateDealStage } from "@/hooks/useDeals";
import { useStages } from "@/hooks/useStages";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Conversation = Tables<"conversations"> & {
  contacts: Tables<"contacts"> & {
    organizations: Tables<"organizations"> | null;
  };
};

interface ContactDetailsSidebarProps {
  conversation: Conversation | null;
}

export default function ContactDetailsSidebar({ conversation }: ContactDetailsSidebarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversationMeta, setSelectedConversationMeta] = useState<any>(null);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [lostDeal, setLostDeal] = useState<{ id: string; title: string } | null>(null);
  const contactId = conversation?.contacts?.id || null;

  const updateDeal = useUpdateDeal();
  const updateDealStage = useUpdateDealStage();
  const { data: stages = [] } = useStages();

  const { data: contactDeals = [] } = useQuery({
    queryKey: ["contact-deals", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          contacts (first_name, last_name),
          organizations (name),
          stages (id, name),
          assigned_user:profiles!deals_assigned_to_fkey (id, full_name, avatar_url)
        `)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId,
  });

  const { data: contactTickets = [] } = useContactTickets(contactId);
  const { data: unifiedTimeline = [] } = useUnifiedTimeline(contactId);
  const { data: ticketStatuses } = useActiveTicketStatuses();

  const { data: conversationMessages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["conversation-history-messages", selectedConversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, content, created_at, sender_type, is_ai_generated, is_internal, sender:profiles!sender_id(full_name)")
        .eq("conversation_id", selectedConversationId!)
        .order("created_at", { ascending: true })
        .limit(500);
      return data || [];
    },
    enabled: !!selectedConversationId,
  });

  if (!conversation) {
    return (
      <div className="h-full w-full border-l bg-slate-50 dark:bg-card border-slate-200 dark:border-border p-6 flex items-center justify-center">
        <p className="text-slate-500 dark:text-muted-foreground text-center">
          Selecione uma conversa
        </p>
      </div>
    );
  }

  const contact = conversation.contacts;

  // Early return se não há contato
  if (!contact) {
    return (
      <div className="h-full w-full border-l bg-slate-50 dark:bg-card flex items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Contato não encontrado</p>
      </div>
    );
  }

  const openTickets = contactTickets.filter(t => t.status !== 'closed' && t.status !== 'resolved');
  
  const conversations = unifiedTimeline
    .filter(e => e.type === 'conversation')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const otherEvents = unifiedTimeline
    .filter(e => e.type !== 'conversation' && e.type !== 'message')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const getConversationStatusBadge = (status: string) => {
    if (status === 'closed') return { label: 'Fechada', className: 'bg-muted text-muted-foreground' };
    if (status === 'open') return { label: 'Aberta', className: 'bg-success/10 text-success' };
    return { label: status, className: 'bg-info/10 text-info' };
  };

  const getChannelLabel = (channel: string) => {
    if (channel === 'whatsapp') return 'WhatsApp';
    if (channel === 'webchat') return 'Webchat';
    if (channel === 'email') return 'Email';
    return channel;
  };
  
  // Verificar se sessão está verificada
  const metadata = conversation.customer_metadata as any;
  const isSessionVerified = metadata?.session_verified ?? true;

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'urgent': return 'text-destructive';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

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

  const priorityConfig: Record<string, { label: string; variant: "outline" | "secondary" | "destructive" }> = {
    low: { label: "Baixa", variant: "outline" },
    medium: { label: "Média", variant: "secondary" },
    high: { label: "Alta", variant: "destructive" },
    urgent: { label: "Urgente", variant: "destructive" },
  };

  return (
    <div className="h-full w-full border-l bg-slate-50 dark:bg-card border-slate-200 dark:border-border flex flex-col overflow-hidden">
      <div className="flex-none p-4 border-b border-slate-200 dark:border-border">
        {/* Contact Info - Compact horizontal layout */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-11 w-11 bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-base font-semibold text-primary">
              {contact.first_name?.[0] || ''}
              {contact.last_name?.[0] || ''}
            </span>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate leading-tight">
              {displayName(contact.first_name, contact.last_name)}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {contact.status === 'lead' ? 'Lead' :
                 contact.status === 'qualified' ? 'Qualificado' :
                 contact.status === 'customer' ? 'Cliente' :
                 contact.status === 'inactive' ? 'Inativo' : 'Churned'}
              </Badge>
              {contact.total_ltv && contact.total_ltv > 0 && (
                <span className="text-xs font-bold text-success">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(contact.total_ltv)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Badge de Sessão Não Verificada */}
        {!isSessionVerified && (
          <Alert variant="default" className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
            <AlertDescription className="text-[10px] text-yellow-700 dark:text-yellow-400">
              Sessão não verificada
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 pt-3">
          {/* Contact Details - Compact */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              {contact.email && (
                <div className="flex items-center gap-2 text-xs">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground truncate">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-xs">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">{contact.phone}</span>
                </div>
              )}
            </div>

            {contact.organizations && (
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground truncate">{contact.organizations.name}</span>
              </div>
            )}

            <Separator className="my-2" />
            
            {/* Tags Permanentes do Contato - Tags da conversa são exibidas no header do ChatWindow */}
            <ContactTagsSection contactId={contact.id} conversationId={conversation?.id} />

            <Separator className="my-2" />

            {/* Tabs Navigation - Compact */}
            <Tabs defaultValue="tickets" className="w-full -mx-4 px-4">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="tickets" className="text-[10px] px-1 gap-0.5">
                  <Ticket className="h-3 w-3" />
                  <span className="hidden sm:inline">Tickets</span>
                </TabsTrigger>
                <TabsTrigger value="deals" className="text-[10px] px-1 gap-0.5">
                  <TrendingUp className="h-3 w-3" />
                  <span className="hidden sm:inline">Negócios</span>
                </TabsTrigger>
                <TabsTrigger value="timeline" className="text-[10px] px-1 gap-0.5">
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">Timeline</span>
                </TabsTrigger>
              </TabsList>

              {/* Tickets Tab */}
              <TabsContent value="tickets" className="mt-3 space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">
                  Tickets Ativos ({openTickets.length})
                </p>
                {openTickets.length > 0 ? (
                  <div className="space-y-1.5">
                    {openTickets.map((ticket) => {
                      const dynStatus = ticketStatuses?.find(s => s.name === ticket.status);
                      const sLabel = dynStatus?.label || fallbackStatusConfig[ticket.status]?.label || ticket.status;
                      const sColor = dynStatus?.color || fallbackStatusConfig[ticket.status]?.color || "#6B7280";
                      const SIcon = dynStatus ? getStatusIcon(dynStatus.icon) : null;
                      const priority = priorityConfig[ticket.priority as keyof typeof priorityConfig];
                      const isOverdue = ticket.due_date && 
                        !['resolved', 'closed'].includes(ticket.status) && 
                        new Date(ticket.due_date) < new Date();

                      return (
                        <div
                          key={ticket.id}
                          className={`p-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer ${isOverdue ? "border-l-2 border-l-destructive bg-destructive/5" : ""}`}
                          onClick={() => navigate(`/support/ticket/${ticket.id}`)}
                        >
                          {/* Line 1: Ticket number + Status badge */}
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5">
                              {isOverdue && <AlertTriangle className="w-3 h-3 text-destructive animate-pulse" />}
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{ticket.ticket_number || ticket.id.slice(0, 8)}
                              </span>
                            </div>
                            <Badge className="text-[9px] px-1 py-0 text-white flex-shrink-0 flex items-center gap-0.5" style={{ backgroundColor: sColor }}>
                              {SIcon && <SIcon className="h-2.5 w-2.5" />}
                              {sLabel}
                            </Badge>
                          </div>

                          {/* Line 2: Subject */}
                          <p className="text-xs font-medium text-foreground line-clamp-1 mb-1">
                            {ticket.subject}
                          </p>

                          {/* Line 3: SLA + Priority + Time */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5">
                              {ticket.due_date && !['resolved', 'closed'].includes(ticket.status) && (
                                <SLABadge 
                                  dueDate={ticket.due_date} 
                                  priority={ticket.priority as 'urgent' | 'high' | 'medium' | 'low'}
                                  size="sm"
                                />
                              )}
                              {priority && (
                                <Badge variant={priority.variant} className="text-[9px] px-1 py-0">
                                  {priority.label}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                              <ChevronRight className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Nenhum ticket ativo
                  </p>
                )}
              </TabsContent>

              {/* Deals Tab */}
              <TabsContent value="deals" className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    Negócios ({contactDeals?.length || 0})
                  </p>
                  <DealDialog
                    prefilledContactId={contact.id}
                    trigger={
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5">
                        <Plus className="h-3 w-3" />
                        Criar
                      </Button>
                    }
                    onOpenChange={(open) => {
                      if (!open) {
                        queryClient.invalidateQueries({ queryKey: ["contact-deals", contactId] });
                      }
                    }}
                  />
                </div>
                {contactDeals && contactDeals.length > 0 ? (
                  <div className="space-y-1.5">
                    {contactDeals.map((deal) => {
                      const dealStages = stages.filter((s: any) => s.pipeline_id === deal.pipeline_id);
                      return (
                        <div
                          key={deal.id}
                          className="p-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors group"
                        >
                          {/* Row 1: Title + Actions Menu */}
                          <div className="flex items-center justify-between gap-1">
                            <p
                              className="text-xs font-medium text-foreground truncate flex-1 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => setEditingDeal(deal)}
                            >
                              {deal.title}
                            </p>
                            <div className="flex items-center gap-0.5">
                              <Badge
                                variant={
                                  deal.status === "won"
                                    ? "default"
                                    : deal.status === "lost"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[9px] px-1 py-0"
                              >
                                {deal.status === "open" ? "Aberto" : deal.status === "won" ? "Ganho" : "Perdido"}
                              </Badge>
                              {deal.status === "open" && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="xs" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem onClick={() => setEditingDeal(deal)}>
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    {dealStages.length > 0 && (
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                          <ArrowRightLeft className="h-3 w-3 mr-2" />
                                          Mudar Etapa
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                          {dealStages.map((stage: any) => (
                                            <DropdownMenuItem
                                              key={stage.id}
                                              disabled={stage.id === deal.stage_id}
                                              onClick={() => {
                                                updateDealStage.mutate(
                                                  { id: deal.id, stage_id: stage.id },
                                                  {
                                                    onSuccess: () => {
                                                      queryClient.invalidateQueries({ queryKey: ["contact-deals", contactId] });
                                                      toast({ title: `Etapa alterada para "${stage.name}"` });
                                                    },
                                                  }
                                                );
                                              }}
                                            >
                                              {stage.name}
                                              {stage.id === deal.stage_id && " ✓"}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        updateDeal.mutate(
                                          { id: deal.id, updates: { status: "won" } },
                                          {
                                            onSuccess: () => {
                                              queryClient.invalidateQueries({ queryKey: ["contact-deals", contactId] });
                                              toast({ title: "🏆 Negócio marcado como ganho!" });
                                            },
                                          }
                                        );
                                      }}
                                      className="text-success"
                                    >
                                      <Trophy className="h-3 w-3 mr-2" />
                                      Marcar como Ganho
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setLostDeal({ id: deal.id, title: deal.title })}
                                      className="text-destructive"
                                    >
                                      <XCircle className="h-3 w-3 mr-2" />
                                      Marcar como Perdido
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                          {/* Row 2: Stage + Value */}
                          <div className="flex items-center justify-between mt-1">
                            {(deal as any).stages?.name && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                📌 {(deal as any).stages.name}
                              </span>
                            )}
                            {deal.value && (
                              <p className="text-xs font-bold text-success">
                                {new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: deal.currency || "BRL",
                                }).format(deal.value)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Nenhum negócio associado
                  </p>
                )}
              </TabsContent>

              {/* Timeline Tab - Conversas + Outros Eventos */}
              <TabsContent value="timeline" className="mt-3 space-y-4">
                {/* Seção: Conversas Anteriores */}
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    Conversas Anteriores ({conversations.length})
                  </p>
                  {conversations.length > 0 ? (
                    <div className="space-y-1.5">
                      {conversations.map((event) => {
                        const meta = event.metadata || {};
                        const statusBadge = getConversationStatusBadge(meta.status || 'open');
                        return (
                          <div
                            key={event.id}
                            className="p-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedConversationId(event.id);
                              setSelectedConversationMeta({ ...meta, date: event.date });
                            }}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="text-[10px] font-medium text-foreground truncate">
                                  {getChannelLabel(meta.channel || '')}
                                </span>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge.className}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{meta.message_count || 0} msgs{meta.profiles?.full_name ? ` · ${meta.profiles.full_name}` : ''}</span>
                              <span>{format(new Date(event.date), "dd/MM HH:mm", { locale: ptBR })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhuma conversa registrada
                    </p>
                  )}
                </div>

                {/* Seção: Outros Eventos */}
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    Outros Eventos ({otherEvents.length})
                  </p>
                  {otherEvents.length > 0 ? (
                    <div className="space-y-1.5">
                      {otherEvents.map((event) => (
                        <div
                          key={event.id}
                          className="p-2 rounded-md border-l-2 border-primary/30 bg-muted/50"
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-xs">{event.icon}</span>
                            <span className="text-[10px] font-medium text-foreground truncate">{event.title}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {event.description}
                          </p>
                          <span className="text-[9px] text-muted-foreground">
                            {format(new Date(event.date), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhum evento registrado
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialog de Histórico da Conversa */}
      <Dialog
        open={selectedConversationId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedConversationId(null);
            setSelectedConversationMeta(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl p-0 overflow-hidden" style={{ maxHeight: '85vh' }}>
          <div className="flex flex-col" style={{ height: '85vh', maxHeight: '85vh' }}>
            <DialogHeader className="flex-none px-6 pt-6 pb-3">
              <DialogTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                {selectedConversationMeta && (
                  <>
                    Conversa {getChannelLabel(selectedConversationMeta.channel || '')}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getConversationStatusBadge(selectedConversationMeta.status || 'open').className}`}>
                      {getConversationStatusBadge(selectedConversationMeta.status || 'open').label}
                    </span>
                  </>
                )}
              </DialogTitle>
              {selectedConversationMeta && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {selectedConversationMeta.profiles?.full_name && (
                    <span>Atendente: {selectedConversationMeta.profiles.full_name}</span>
                  )}
                  {selectedConversationMeta.date && (
                    <span>· {format(new Date(selectedConversationMeta.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  )}
                </div>
              )}
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-6">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando mensagens...</span>
                </div>
              ) : conversationMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhuma mensagem encontrada
                </p>
              ) : (
                <div className="space-y-2 py-2">
                  {conversationMessages.map((msg: any) => {
                    const isContact = msg.sender_type === 'contact';
                    const isInternal = msg.is_internal === true;
                    const senderName = isContact
                      ? 'Cliente'
                      : msg.is_ai_generated
                      ? 'IA'
                      : msg.sender?.full_name || 'Agente';

                    if (isInternal) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="max-w-[85%] p-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-medium text-yellow-700 dark:text-yellow-300">📝 Nota Interna</span>
                              <span className="text-[10px] text-yellow-600 dark:text-yellow-400">· {senderName}</span>
                            </div>
                            <p className="text-xs text-yellow-800 dark:text-yellow-200 whitespace-pre-wrap">{msg.content}</p>
                            <span className="text-[9px] text-yellow-600 dark:text-yellow-400 mt-1 block text-right">
                              {format(new Date(msg.created_at), "HH:mm")}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex ${isContact ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[75%] p-2.5 rounded-lg ${isContact ? 'bg-muted' : 'bg-primary/10'}`}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-semibold text-foreground">{senderName}</span>
                          </div>
                          <p className="text-xs text-foreground whitespace-pre-wrap break-words">{msg.content}</p>
                          <span className="text-[9px] text-muted-foreground mt-1 block text-right">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {conversationMessages.length >= 500 && (
                    <p className="text-[10px] text-center text-muted-foreground py-2">
                      ⚠️ Mostrando apenas as 500 primeiras mensagens
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex-none px-6 py-3 border-t border-border flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  const convId = selectedConversationId;
                  const convStatus = selectedConversationMeta?.status;
                  setSelectedConversationId(null);
                  setSelectedConversationMeta(null);
                  const filterParam = convStatus === 'closed' ? '&filter=archived' : '';
                  navigate(`/inbox?conversation=${convId}${filterParam}`);
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no Inbox
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={conversationMessages.length === 0}
                onClick={() => {
                  const contactName = contact ? displayName(contact.first_name, contact.last_name) : "Contato";
                  const status = selectedConversationMeta?.status === "closed" ? "Fechada" : "Aberta";
                  const channel = selectedConversationMeta?.channel || "WhatsApp";
                  const agent = selectedConversationMeta?.assigned_agent_name || "Não atribuído";
                  const date = selectedConversationMeta?.created_at
                    ? format(new Date(selectedConversationMeta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

                  let text = `Conversa ${channel} - ${contactName}\n`;
                  text += `Status: ${status} | Data: ${date}\n`;
                  text += `Atendente: ${agent}\n`;
                  text += `${"=".repeat(40)}\n\n`;

                  conversationMessages.forEach((msg: any) => {
                    const time = format(new Date(msg.created_at), "HH:mm");
                    const isContact = msg.sender_type === "contact";
                    const isInternal = msg.is_internal === true;
                    const sender = isInternal
                      ? "📝 Nota Interna"
                      : isContact
                      ? "Cliente"
                      : msg.is_ai_generated
                      ? "IA"
                      : msg.sender?.full_name || "Agente";
                    text += `[${time}] ${sender}: ${msg.content || ""}\n\n`;
                  });

                  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `conversa_${contactName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Deal Dialog */}
      {editingDeal && (
        <DealDialog
          deal={editingDeal}
          trigger={<></>}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setEditingDeal(null);
              queryClient.invalidateQueries({ queryKey: ["contact-deals", contactId] });
            }
          }}
        />
      )}

      {/* Lost Reason Dialog */}
      <LostReasonDialog
        open={!!lostDeal}
        onClose={() => setLostDeal(null)}
        dealTitle={lostDeal?.title || ""}
        onConfirm={(reason, notes) => {
          if (!lostDeal) return;
          updateDeal.mutate(
            {
              id: lostDeal.id,
              updates: {
                status: "lost",
                lost_reason: reason,
              },
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["contact-deals", contactId] });
                toast({ title: "Negócio marcado como perdido", variant: "destructive" });
                setLostDeal(null);
              },
            }
          );
        }}
      />
    </div>
  );
}
