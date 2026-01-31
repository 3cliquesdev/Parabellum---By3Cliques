import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Phone, Building2, Plus, Clock, AlertCircle, TrendingUp, Ticket } from "lucide-react";
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
              {contact.first_name} {contact.last_name}
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
              ⚠️ Sessão não verificada
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
            <ContactTagsSection contactId={contact.id} />

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
                    {openTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-xs font-medium text-foreground line-clamp-1 flex-1">
                            {ticket.subject}
                          </p>
                          <Badge {...getStatusBadge(ticket.status)} className="text-[9px] px-1 py-0 flex-shrink-0">
                            {getStatusBadge(ticket.status).label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <SLABadge 
                            dueDate={ticket.due_date} 
                            priority={ticket.priority}
                            size="sm"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(ticket.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    ))}
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
                    onOpenChange={(open) => {}}
                  />
                </div>
                {contactDeals && contactDeals.length > 0 ? (
                  <div className="space-y-1.5">
                    {contactDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="p-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-medium text-foreground truncate flex-1">
                            {deal.title}
                          </p>
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
                        </div>
                        {deal.value && (
                          <p className="text-xs font-bold text-success mt-0.5">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: deal.currency || "BRL",
                            }).format(deal.value)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Nenhum negócio associado
                  </p>
                )}
              </TabsContent>

              {/* Timeline Tab - Unified Timeline */}
              <TabsContent value="timeline" className="mt-3 space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">
                  Histórico Unificado
                </p>
                {recentTimeline.length > 0 ? (
                  <div className="space-y-1.5">
                    {recentTimeline.map((event) => (
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
                  <p className="text-xs text-muted-foreground text-center py-3">
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
