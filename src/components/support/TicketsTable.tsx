import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle, UserPen, AlertTriangle, Eye, Tag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ApprovalStatusBadge } from "@/components/ApprovalStatusBadge";
import { SLABadge } from "@/components/SLABadge";

interface ViewingInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Ticket {
  id: string;
  ticket_number?: string | null;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed' | 'returned' | 'loja_bloqueada' | 'loja_concluida' | 'pending_approval' | 'approved';
  created_at: string;
  due_date: string | null;
  created_by?: string | null;
  assigned_to?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  customer: {
    id?: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
  } | null;
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  } | null;
  created_by_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  } | {
    id: string;
    full_name: string;
    avatar_url?: string;
  }[] | null;
  department?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

interface TicketsTableProps {
  tickets: Ticket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  selectedTicketIds?: string[];
  onToggleSelect?: (ticketId: string) => void;
  onToggleSelectAll?: () => void;
  getViewersForTicket?: (ticketId: string) => ViewingInfo[];
}

const defaultStatusConfig = { icon: Clock, color: "text-muted-foreground", bg: "bg-muted-foreground" };

const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
  open: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500" },
  in_progress: { icon: Clock, color: "text-primary", bg: "bg-primary" },
  waiting_customer: { icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500" },
  resolved: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500" },
  closed: { icon: CheckCircle, color: "text-muted-foreground", bg: "bg-muted-foreground" },
  pending_approval: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-500" },
  returned: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500" },
  loja_bloqueada: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500" },
  loja_concluida: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500" },
  approved: { icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-500" },
};

const statusLabels: Record<string, string> = {
  open: 'Novo',
  in_progress: 'Em Análise',
  waiting_customer: 'Aguardando',
  resolved: 'Resolvido',
  closed: 'Fechado',
  pending_approval: 'Aguard. Aprovação',
  returned: 'Devolvido',
  loja_bloqueada: 'Loja Bloqueada',
  loja_concluida: 'Loja Concluída',
  approved: 'Aprovado',
};

// Helper to get creator name from created_by_user (can be array or object)
function getCreatorName(createdByUser: { full_name: string } | { full_name: string }[] | null | undefined): string | null {
  if (!createdByUser) return null;
  if (Array.isArray(createdByUser)) {
    return createdByUser[0]?.full_name || null;
  }
  return createdByUser.full_name || null;
}

const priorityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

function formatTicketDate(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) {
    return `Hoje ${format(date, 'HH:mm')}`;
  }
  if (isYesterday(date)) {
    return `Ontem ${format(date, 'HH:mm')}`;
  }
  return format(date, "dd MMM", { locale: ptBR });
}

function isSlaExpired(dueDate: string | null, status: string): boolean {
  if (!dueDate || ['resolved', 'closed'].includes(status)) return false;
  return new Date(dueDate) < new Date();
}

export function TicketsTable({ 
  tickets, 
  selectedTicketId, 
  onSelectTicket,
  selectedTicketIds = [],
  onToggleSelect,
  onToggleSelectAll,
  getViewersForTicket,
}: TicketsTableProps) {
  const { user } = useAuth();

  // Fetch ticket IDs that have tags
  const ticketIds = tickets.map(t => t.id);
  const { data: ticketTagsData } = useQuery({
    queryKey: ["ticket-tags-check", ticketIds.join(',')],
    queryFn: async () => {
      if (ticketIds.length === 0) return [];
      const { data } = await supabase
        .from("ticket_tags")
        .select("ticket_id")
        .in("ticket_id", ticketIds);
      return data || [];
    },
    enabled: ticketIds.length > 0,
  });

  const ticketIdsWithTags = new Set(ticketTagsData?.map(tt => tt.ticket_id) || []);

  if (tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center bg-card">
        <p className="text-muted-foreground">Nenhum ticket encontrado</p>
      </div>
    );
  }

  const allSelected = tickets.length > 0 && selectedTicketIds.length === tickets.length;
  const someSelected = selectedTicketIds.length > 0 && selectedTicketIds.length < tickets.length;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Table Header */}
      <div className="flex-none border-b border-border bg-muted/50">
        <div className="grid grid-cols-[40px_110px_minmax(100px,1.2fr)_minmax(80px,0.6fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)_minmax(80px,0.6fr)_50px_70px_60px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {onToggleSelectAll && (
            <div className="flex items-center justify-center">
              <Checkbox 
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
                className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
              />
            </div>
          )}
          {!onToggleSelectAll && <div />}
          <div>Protocolo</div>
          <div>Assunto</div>
          <div>SLA</div>
          <div>Solicitante</div>
          <div>Responsável</div>
          <div>Departamento</div>
          <div className="flex items-center justify-center">
            <Eye className="w-3 h-3" />
          </div>
          <div className="text-right">Data</div>
          <div className="text-center">Origem</div>
        </div>
      </div>

      {/* Table Body */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {tickets.map((ticket) => {
            const statusEntry = statusConfig[ticket.status] || defaultStatusConfig;
            const StatusIcon = statusEntry.icon;
            const isSelected = selectedTicketId === ticket.id;
            const isChecked = selectedTicketIds.includes(ticket.id);
            const slaExpired = isSlaExpired(ticket.due_date, ticket.status);
            const isCreatedByMe = ticket.created_by === user?.id;
            const isAssignedToOther = ticket.assigned_to && ticket.assigned_to !== user?.id;
            const showCreatedByMeBadge = isCreatedByMe && isAssignedToOther;
            const viewers = getViewersForTicket?.(ticket.id) || [];

            const creatorName = getCreatorName(ticket.created_by_user);
            const isCreatedByAgent = !!ticket.created_by && !!creatorName;

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectTicket(ticket.id)}
                className={cn(
                  "grid grid-cols-[40px_110px_minmax(100px,1.2fr)_minmax(80px,0.6fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)_minmax(80px,0.6fr)_50px_70px_60px] gap-2 px-3 py-3 cursor-pointer transition-colors items-center",
                  isSelected 
                    ? "bg-primary/5 border-l-2 border-primary" 
                    : "hover:bg-accent/50 border-l-2 border-transparent",
                  viewers.length > 0 && "bg-primary/5",
                  slaExpired && "border-l-2 border-l-destructive bg-destructive/5"
                )}
              >
                {/* Checkbox */}
                <div 
                  className="flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect?.(ticket.id);
                  }}
                >
                  {onToggleSelect && (
                    <Checkbox checked={isChecked} />
                  )}
                </div>

                {/* Protocol + Status */}
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", statusEntry.bg)} />
                  {slaExpired && (
                    <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0 animate-pulse" />
                  )}
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {ticket.ticket_number || `#${ticket.id.slice(0, 6)}`}
                  </span>
                </div>

                {/* Subject */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate text-foreground">
                    {ticket.subject}
                  </span>
                  {/* Approval Status Badge */}
                  <ApprovalStatusBadge
                    status={ticket.status}
                    approvedBy={ticket.approved_by}
                    approvedAt={ticket.approved_at}
                    rejectionReason={ticket.rejection_reason}
                    size="sm"
                  />
                  {/* No tags indicator */}
                  {!ticketIdsWithTags.has(ticket.id) && !['resolved', 'closed'].includes(ticket.status) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-shrink-0 inline-flex items-center text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                            <Tag className="h-2.5 w-2.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">Sem tag</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {showCreatedByMeBadge && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      <UserPen className="h-2.5 w-2.5" />
                    </span>
                  )}
                  <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", priorityColors[ticket.priority])} />
                </div>

                {/* SLA Badge - New Column */}
                <div className="flex items-center">
                  {ticket.due_date && !['resolved', 'closed'].includes(ticket.status) ? (
                    <SLABadge 
                      dueDate={ticket.due_date} 
                      priority={ticket.priority as 'urgent' | 'high' | 'medium' | 'low'}
                      size="sm"
                      showIcon={true}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </div>

                {/* Solicitante (quem abriu) */}
                <div className="text-sm text-muted-foreground truncate">
                  {isCreatedByAgent ? (
                    <span className="truncate">{creatorName}</span>
                  ) : (
                    <span className="truncate">
                      {ticket.customer?.first_name} {ticket.customer?.last_name}
                    </span>
                  )}
                </div>

                {/* Responsável */}
                <div className="text-sm text-muted-foreground truncate">
                  {ticket.assigned_user?.full_name || (
                    <span className="text-muted-foreground/50 italic">Não atribuído</span>
                  )}
                </div>

                {/* Department */}
                <div className="text-sm truncate">
                  {ticket.department?.name ? (
                    <span 
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: ticket.department.color ? `${ticket.department.color}20` : undefined,
                        color: ticket.department.color || undefined
                      }}
                    >
                      {ticket.department.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </div>

                {/* Viewers */}
                <div className="flex items-center justify-center">
                  {viewers.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1.5">
                              {viewers.slice(0, 2).map((viewer) => (
                                <Avatar key={viewer.user_id} className="w-5 h-5 border border-background">
                                  {viewer.avatar_url ? (
                                    <AvatarImage src={viewer.avatar_url} alt={viewer.full_name} />
                                  ) : null}
                                  <AvatarFallback className="bg-primary text-primary-foreground text-[8px]">
                                    {viewer.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                            {viewers.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{viewers.length - 2}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p className="text-xs font-medium mb-1">Visualizando agora:</p>
                          {viewers.map((v) => (
                            <p key={v.user_id} className="text-xs">{v.full_name}</p>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Date */}
                <div className="text-xs text-muted-foreground text-right">
                  {formatTicketDate(ticket.created_at)}
                </div>

                {/* Origem (Agente ou Cliente) */}
                <div className="flex items-center justify-center">
                  {isCreatedByAgent ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 whitespace-nowrap">
                            Agente
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p className="text-xs">Aberto por {creatorName}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 whitespace-nowrap">
                      Cliente
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
