import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Phone, Building2, Plus, FileText, Clock, AlertCircle, TrendingUp, Ticket } from "lucide-react";
import ContactTagsSection from "./inbox/ContactTagsSection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useContactTickets } from "@/hooks/useContactTickets";
import { useUnifiedTimeline } from "@/hooks/useUnifiedTimeline";
import DealDialog from "./DealDialog";
import { SLABadge } from "./SLABadge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Conversation = Tables<"conversations"> & {
  contacts: Tables<"contacts"> & {
    organizations: Tables<"organizations"> | null;
  };
};

interface ContactDetailsSidebarProps {
  conversation: Conversation | null;
}

export default function ContactDetailsSidebar({ conversation }: ContactDetailsSidebarProps) {
  const contactId = conversation?.contacts?.id || null;

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
  const recentTimeline = unifiedTimeline.slice(0, 10);
  
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

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'open': return { label: 'Aberto', variant: 'secondary' as const };
      case 'in_progress': return { label: 'Em Progresso', variant: 'default' as const };
      case 'waiting_customer': return { label: 'Aguardando Cliente', variant: 'outline' as const };
      case 'resolved': return { label: 'Resolvido', variant: 'default' as const };
      case 'closed': return { label: 'Fechado', variant: 'secondary' as const };
      default: return { label: status, variant: 'secondary' as const };
    }
  };

  return (
    <div className="h-full w-full border-l bg-slate-50 dark:bg-card border-slate-200 dark:border-border flex flex-col overflow-hidden">
      <div className="flex-none p-6 border-b border-slate-200 dark:border-border">
          {/* Contact Info */}
          <div className="flex flex-col items-center mb-6">
            <Avatar className="h-20 w-20 bg-primary/10 flex items-center justify-center mb-3">
              <span className="text-2xl font-semibold text-primary">
                {contact.first_name?.[0] || ''}
                {contact.last_name?.[0] || ''}
              </span>
            </Avatar>
            <h3 className="text-lg font-semibold text-foreground text-center">
              {contact.first_name} {contact.last_name}
            </h3>
            <Badge variant="secondary" className="mt-2">
              {contact.status === 'lead' ? '🎯 Lead' :
               contact.status === 'qualified' ? '✅ Qualificado' :
               contact.status === 'customer' ? '⭐ Cliente' :
               contact.status === 'inactive' ? '😴 Inativo' : '❌ Churned'}
            </Badge>
            {contact.total_ltv && contact.total_ltv > 0 && (
              <div className="mt-3 text-center">
                <p className="text-xs text-muted-foreground uppercase mb-1">Lifetime Value</p>
                <p className="text-lg font-bold text-success">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(contact.total_ltv)}
                </p>
              </div>
            )}
          </div>

          {/* Badge de Sessão Não Verificada */}
          {!isSessionVerified && (
            <Alert variant="default" className="mt-3 border-yellow-600 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-xs text-yellow-700 dark:text-yellow-400">
                ⚠️ Sessão não verificada - não compartilhe dados sensíveis como senhas ou dados bancários
              </AlertDescription>
            </Alert>
          )}
        </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-6 pt-4">
          <Separator className="mb-4" />

          {/* Contact Details */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                Informações de Contato
              </p>
              {contact.email && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{contact.phone}</span>
                </div>
              )}
            </div>

            {contact.organizations && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    Organização
                  </p>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">
                      {contact.organizations.name}
                    </span>
                  </div>
                </div>
              </>
            )}

            <Separator />
            
            {/* Tags Section */}
            <ContactTagsSection contactId={contact.id} />

            <Separator />

            {/* Tabs Navigation */}
            <Tabs defaultValue="tickets" className="w-full -mx-6 px-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tickets" className="text-xs">
                  <Ticket className="h-3 w-3 mr-1" />
                  Tickets
                </TabsTrigger>
                <TabsTrigger value="deals" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Negócios
                </TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Timeline
                </TabsTrigger>
              </TabsList>

              {/* Tickets Tab */}
              <TabsContent value="tickets" className="mt-4 space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Tickets Ativos ({openTickets.length})
                  </p>
                </div>
                {openTickets.length > 0 ? (
                  <div className="space-y-2">
                    {openTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            <p className="text-sm font-medium text-foreground line-clamp-1">
                              {ticket.subject}
                            </p>
                          </div>
                          <Badge {...getStatusBadge(ticket.status)} className="text-xs ml-2 flex-shrink-0">
                            {getStatusBadge(ticket.status).label}
                          </Badge>
                        </div>
                        
                        {/* SLA Visual Alert */}
                        <div className="mb-3">
                          <SLABadge 
                            dueDate={ticket.due_date} 
                            priority={ticket.priority}
                            size="sm"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <span>{format(new Date(ticket.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                        </div>

                        {ticket.assigned_user && (
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar className="h-5 w-5 bg-primary/10">
                              <span className="text-[10px] text-primary">
                                {ticket.assigned_user.full_name[0]}
                              </span>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {ticket.assigned_user.full_name}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum ticket ativo
                  </p>
                )}
              </TabsContent>

              {/* Deals Tab */}
              <TabsContent value="deals" className="mt-4 space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Negócios ({contactDeals?.length || 0})
                  </p>
                  <DealDialog
                    prefilledContactId={contact.id}
                    trigger={
                      <Button variant="ghost" size="sm" className="h-7 gap-1">
                        <Plus className="h-3 w-3" />
                        Criar
                      </Button>
                    }
                    onOpenChange={(open) => {}}
                  />
                </div>
                {contactDeals && contactDeals.length > 0 ? (
                  <div className="space-y-2">
                    {contactDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground mb-1">
                          {deal.title}
                        </p>
                        {deal.value && (
                          <p className="text-sm font-bold text-success">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: deal.currency || "BRL",
                            }).format(deal.value)}
                          </p>
                        )}
                        <Badge
                          variant={
                            deal.status === "won"
                              ? "default"
                              : deal.status === "lost"
                              ? "destructive"
                              : "secondary"
                          }
                          className="mt-2"
                        >
                          {deal.status === "open"
                            ? "Aberto"
                            : deal.status === "won"
                            ? "Ganho"
                            : "Perdido"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum negócio associado
                  </p>
                )}
              </TabsContent>

              {/* Timeline Tab - Unified Timeline */}
              <TabsContent value="timeline" className="mt-4 space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Histórico Unificado
                  </p>
                </div>
                {recentTimeline.length > 0 ? (
                  <div className="space-y-3">
                    {recentTimeline.map((event) => (
                      <div
                        key={event.id}
                        className="p-3 rounded-lg border-l-2 border-primary/30 bg-muted/50"
                      >
                        <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                          <span>{event.icon}</span>
                          <span>{event.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {event.description}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum histórico registrado
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
