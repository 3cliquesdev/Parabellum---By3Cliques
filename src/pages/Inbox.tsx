import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useInboxView, useInboxCounts, type InboxFilters as InboxViewFiltersType, type InboxCounts } from "@/hooks/useInboxView";
import { useMyNotRespondedInboxItems } from "@/hooks/useMyNotRespondedInboxItems";
import { useMyInboxItems } from "@/hooks/useMyInboxItems";
import { useSlaExceededItems } from "@/hooks/useSlaExceededItems";
import { useInboxSearch } from "@/hooks/useInboxSearch";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartments } from "@/hooks/useDepartments";
import { useTeams, useUserTeams } from "@/hooks/useTeams";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import ContactDetailsSidebar from "@/components/ContactDetailsSidebar";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";
import InboxFilterPopover, { type InboxFilters } from "@/components/inbox/InboxFilterPopover";
import { ActiveFilterChips } from "@/components/inbox/ActiveFilterChips";
import { BulkActionsBar } from "@/components/inbox/BulkActionsBar";
import { InboxBulkDistributeBar } from "@/components/inbox/InboxBulkDistributeBar";
import { InboxBulkDistributeDialog } from "@/components/inbox/InboxBulkDistributeDialog";
import { BroadcastAIQueueButton } from "@/components/inbox/BroadcastAIQueueButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, CheckSquare, X } from "lucide-react";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import { useBulkReactivateAI } from "@/hooks/useBulkReactivateAI";
import { useBulkCloseConversations } from "@/hooks/useBulkCloseConversations";
import { useConversationCloseSettings } from "@/hooks/useConversationCloseSettings";

import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact;
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
  } | null;
};

const DEFAULT_FILTERS: InboxFilters = {
  dateRange: undefined,
  channels: [],
  status: [],
  assignedTo: undefined,
  tags: [],
  search: "",
  slaExpired: false,
  hasAudio: undefined,
  hasAttachments: undefined,
  aiMode: undefined,
  includeArchived: undefined,
  waitingTime: 'oldest', // Por padrão, mostrar mais antigas primeiro para priorização
};

type MobileView = "list" | "chat" | "details";

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  const isMobile = useIsMobileBreakpoint();
  
  // Filter state
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);
  
  // Mobile navigation state
  const [mobileView, setMobileView] = useState<MobileView>("list");
  
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDistributeDialog, setShowDistributeDialog] = useState(false);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true);
  const bulkReactivate = useBulkReactivateAI();
  const bulkClose = useBulkCloseConversations();
  const { tagsRequired } = useConversationCloseSettings();
  
  // Smart default filter based on role
  const defaultFilter = (role === 'admin' || role === 'manager') ? 'all' : 'human_queue';
  const filter = searchParams.get("filter") || defaultFilter;
  
  const departmentFilter = searchParams.get("dept");
  const teamFilter = searchParams.get("team");
  const tagFilter = searchParams.get("tag");
  const agentFilter = searchParams.get("agent");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  
  // Deep-link: selecionar conversa via ?conversation=ID
  const conversationFromUrl = searchParams.get("conversation");
  const deepLinkHandledRef = useRef<string | null>(null);
  
  // ✅ ESTABILIZAR filtros com useMemo para evitar refetch desnecessário
  const inboxViewFilters = useMemo<InboxViewFiltersType>(() => ({
    dateRange: filters.dateRange,
    channels: filters.channels,
    status: filters.status,
    assignedTo: filters.assignedTo,
    search: filters.search,
    slaStatus: filters.slaExpired ? 'critical' : undefined,
    hasAudio: filters.hasAudio,
    hasAttachments: filters.hasAttachments,
    aiMode: filters.aiMode as InboxViewFiltersType['aiMode'],
    department: departmentFilter || undefined,
    tags: filters.tags && filters.tags.length > 0
      ? filters.tags
      : (tagFilter ? [tagFilter] : undefined),
  }), [filters.dateRange, filters.channels, filters.status, filters.assignedTo,
       filters.search, filters.slaExpired, filters.hasAudio, filters.hasAttachments,
       filters.aiMode, departmentFilter, tagFilter, filters.tags]);
  
  // ✅ FIX: Passar scope explícito — 2 caches brutos (active/archived)
  const isArchived = filter === "archived";
  const inboxScope = isArchived ? 'archived' as const : 'active' as const;
  const { data: inboxItems, isLoading: inboxLoading } = useInboxView(inboxViewFilters, inboxScope);
  
  const { data: counts } = useInboxCounts(user?.id);
  
  // ✅ LAZY-LOAD: hooks dedicados só rodam quando o filtro correspondente está ativo
  const isMine = filter === "mine";
  const isNotResponded = filter === "not_responded";
  const isSla = filter === "sla";

  const myNotRespondedQuery = useMyNotRespondedInboxItems({ enabled: isNotResponded, refetchInterval: 60_000 });
  const myInboxQuery = useMyInboxItems({ enabled: isMine, refetchInterval: 60_000 });
  const slaQuery = useSlaExceededItems({ enabled: isSla, refetchInterval: 60_000 });
  
  // 🔍 Hook dedicado para BUSCA - query direta ao banco sem limite artificial
  const { data: searchResults, isLoading: searchLoading } = useInboxSearch(filters.search || "");
  
  const { data: departments } = useDepartments();
  const { data: teams } = useTeams();
  const { data: userTeams } = useUserTeams(user?.id);

  const handleSelectConversation = (conversation: Conversation | null) => {
    setActiveConversation(conversation);
    if (isMobile && conversation) {
      setMobileView("chat");
    }
  };

  const handleBackToList = () => {
    setMobileView("list");
  };

  const handleShowDetails = () => {
    setMobileView("details");
  };

  const handleBackToChat = () => {
    setMobileView("chat");
  };

  // 🔧 Helper: Converte um InboxItem em objeto Conversation mínimo
  const inboxItemToConversation = useCallback((item: any): Conversation => {
    return {
      id: item.conversation_id,
      contact_id: item.contact_id,
      status: item.status,
      ai_mode: item.ai_mode,
      assigned_to: item.assigned_to,
      department: item.department,
      channel: item.channel || (item.whatsapp_provider ? 'whatsapp' : item.last_channel),
      created_at: item.created_at,
      last_message_at: item.last_message_at,
      updated_at: item.updated_at,
      awaiting_rating: false,
      auto_closed: false,
      closed_at: null,
      closed_by: null,
      closed_reason: null,
      customer_metadata: null,
      dispatch_attempts: null,
      dispatch_status: null,
      first_response_at: null,
      handoff_executed_at: null,
      is_test_mode: false,
      last_classified_at: null,
      last_dispatch_at: null,
      last_suggestion_at: null,
      learned_at: null,
      needs_human_review: false,
      previous_agent_id: null,
      rating_sent_at: null,
      deal_id: item.deal_id || null,
      related_ticket_id: null,
      session_token: null,
      support_channel_id: null,
      whatsapp_instance_id: item.whatsapp_instance_id || null,
      whatsapp_meta_instance_id: item.whatsapp_meta_instance_id || null,
      whatsapp_provider: item.whatsapp_provider || null,
      window_keep_alive_sent_at: item.window_keep_alive_sent_at || null,
      resolved_by: item.resolved_by || null,
      contacts: {
        id: item.contact_id,
        first_name: item.contact_name?.split(' ')[0] || 'Contato',
        last_name: item.contact_name?.split(' ').slice(1).join(' ') || '',
        email: item.contact_email,
        phone: item.contact_phone,
        avatar_url: item.contact_avatar,
        organizations: null,
        created_at: item.created_at,
        account_balance: null,
        address: null,
        address_complement: null,
        address_number: null,
        assigned_to: null,
        birth_date: null,
        blocked: false,
        city: null,
        company: null,
        consultant_id: null,
        customer_type: null,
        document: null,
        external_ids: null,
        kiwify_customer_id: null,
        kiwify_subscription_id: null,
        kiwify_validated: (item as any).contact_kiwify_validated ?? null,
        kiwify_validated_at: null,
        last_contact_date: null,
        last_kiwify_event: null,
        last_kiwify_event_at: null,
        last_payment_date: null,
        lead_classification: null,
        lead_score: null,
        neighborhood: null,
        next_payment_date: null,
        onboarding_submission_id: null,
        organization_id: null,
        recent_orders_count: null,
        registration_date: null,
        source: null,
        state: null,
        state_registration: null,
        status: (item as any).contact_status ?? null,
        subscription_plan: null,
        support_channel_id: null,
        total_ltv: null,
        whatsapp_id: item.contact_whatsapp_id || item.contact_phone || null,
        zip_code: null,
      } as Contact,
      department_data: item.department_name ? {
        id: item.department,
        name: item.department_name,
        color: item.department_color || null,
      } : null,
      assigned_user: item.assigned_agent_name ? {
        id: item.assigned_to,
        full_name: item.assigned_agent_name,
        avatar_url: item.assigned_agent_avatar || null,
        job_title: null,
      } : null,
    } as Conversation;
  }, []);

  // ✅ FONTE ÚNICA por filtro — activeItems SEMPRE retorna array (nunca null)
  const debouncedSearch = useDebouncedValue(filters.search || "", 300);
  const hasActiveSearch = debouncedSearch.trim().length >= 2;

  const activeItems = useMemo(() => {
    if (hasActiveSearch) return searchResults ?? [];
    if (isNotResponded) return myNotRespondedQuery.data ?? [];
    if (isMine) return myInboxQuery.data ?? [];
    if (isSla) return slaQuery.data ?? [];
    return inboxItems ?? [];
  }, [hasActiveSearch, searchResults, isNotResponded, myNotRespondedQuery.data,
      isMine, myInboxQuery.data, isSla, slaQuery.data, inboxItems]);

  const filteredConversations = useMemo(() => {
    let result = activeItems.map(inboxItemToConversation);

    // Department filter
    if (departmentFilter) {
      result = result.filter(c => c.department === departmentFilter);
    }

    // Agent filter
    if (agentFilter) {
      result = result.filter(c => c.assigned_to === agentFilter);
    }

    // Filter by URL param
    switch (filter) {
      case "ai_queue":
        return result.filter(c => c.ai_mode === 'autopilot' && c.status !== 'closed');
      case "human_queue":
        if (role === 'admin' || role === 'manager' || role === 'support_manager' || role === 'cs_manager' || role === 'general_manager') {
          return result.filter(c => c.ai_mode !== 'autopilot' && c.status !== 'closed');
        }
        if (departmentFilter) {
          return result.filter(c => c.ai_mode !== 'autopilot' && c.status !== 'closed');
        }
        return result.filter(c => c.ai_mode !== 'autopilot' && c.assigned_to === user?.id && c.status !== 'closed');
      case "mine":
        return result.filter(c => c.assigned_to === user?.id && c.status !== 'closed');
      case "not_responded":
      case "sla":
        return result; // Já vem filtrado do hook dedicado
      case "unassigned":
        return result.filter(c => !c.assigned_to && c.status !== 'closed' && c.ai_mode !== 'autopilot');
      case "archived":
        return result; // ✅ Cache já vem com scope=archived, sem re-filtrar
      default:
        return result.filter(c => c.status !== 'closed');
    }
  }, [activeItems, inboxItemToConversation, departmentFilter, agentFilter, filter, role, user?.id]);

  // ✅ Loading do activeQuery ativo (isLoading real de cada hook)
  const activeLoading = hasActiveSearch ? searchLoading :
    isNotResponded ? myNotRespondedQuery.isLoading :
    isMine ? myInboxQuery.isLoading :
    isSla ? slaQuery.isLoading :
    inboxLoading;

  const isPageLoading = activeLoading;

  // Ordenação e filtragem por tempo de espera
  const orderedConversations = useMemo(() => {
    let result = [...filteredConversations];
    const now = new Date();
    
    // Aplicar filtro de tempo de espera
    if (filters.waitingTime && filters.waitingTime !== 'all' && filters.waitingTime !== 'newest' && filters.waitingTime !== 'oldest') {
      const thresholds: Record<string, number> = {
        '1h': 1 * 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const threshold = thresholds[filters.waitingTime];
      if (threshold) {
        result = result.filter(c => {
          const lastMsg = new Date(c.last_message_at);
          return (now.getTime() - lastMsg.getTime()) >= threshold;
        });
      }
    }
    
    // 🔍 BUSCA ATIVA: Resultados já vêm ordenados do banco (useInboxSearch)
    if (hasActiveSearch) {
      return result;
    }
    
    // Encerradas: mais recentes primeiro (descending by updated_at)
    if (isArchived) {
      result.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
      return result;
    }

    // Ordenar por tempo de espera
    if (filters.waitingTime === 'newest') {
      result.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    } else {
      // 'oldest': mais antigas primeiro — ordenação direta por last_message_at
      result.sort((a, b) => 
        new Date(a.last_message_at).getTime() - new Date(b.last_message_at).getTime()
      );
    }

    return result;
  }, [filteredConversations, filters.waitingTime, hasActiveSearch]);

  // Deep-link: auto-selecionar conversa quando lista carrega
  useEffect(() => {
    if (!conversationFromUrl) return;
    if (deepLinkHandledRef.current === conversationFromUrl) return;
    if (activeConversation?.id === conversationFromUrl) {
      deepLinkHandledRef.current = conversationFromUrl;
      return;
    }
    
    const target = orderedConversations.find(c => c.id === conversationFromUrl);
    if (target) {
      setActiveConversation(target);
      deepLinkHandledRef.current = conversationFromUrl;
      if (isMobile) setMobileView("chat");
    }
  }, [conversationFromUrl, orderedConversations, activeConversation?.id, isMobile]);


  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === orderedConversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orderedConversations.map(c => c.id)));
    }
  }, [selectedIds.size, orderedConversations]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const handleBulkReactivateAI = useCallback(() => {
    if (selectedIds.size > 0) {
      bulkReactivate.mutate(Array.from(selectedIds), {
        onSuccess: handleClearSelection
      });
    }
  }, [selectedIds, bulkReactivate, handleClearSelection]);

  const handleBulkCloseConversations = useCallback(() => {
    if (selectedIds.size > 0) {
      bulkClose.mutate(
        { conversationIds: Array.from(selectedIds), tagsRequired },
        { onSuccess: handleClearSelection }
      );
    }
  }, [selectedIds, bulkClose, handleClearSelection, tagsRequired]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  // Use optimized counts from inbox_view
  const totalActiveCount = (counts?.total || 0);
  const aiQueueCount = counts?.aiQueue || 0;
  const humanQueueCount = counts?.humanQueue || 0;
  
  const currentFilterCount = orderedConversations.length;
  const hasHiddenConversations = currentFilterCount === 0 && totalActiveCount > 0;

  const displayTotalCount = totalActiveCount > 0 ? totalActiveCount : (filteredConversations?.length ?? 0);

  // Default sidebar counts
  const sidebarCounts: InboxCounts = counts || {
    total: 0,
    mine: 0,
    aiQueue: 0,
    humanQueue: 0,
    slaCritical: 0,
    slaWarning: 0,
    notResponded: 0,
    myNotResponded: 0,
    unassigned: 0,
    unread: 0,
    closed: 0,
    byDepartment: [],
    byTag: [],
  };

  // Mobile Layout - Stack Navigation
  if (isMobile) {
    // Mobile: Details View
    if (mobileView === "details" && activeConversation) {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-none border-b border-border px-4 py-3 bg-card flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackToChat}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold">Detalhes do Contato</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ContactDetailsSidebar conversation={activeConversation} />
          </div>
        </div>
      );
    }

    // Mobile: Chat View
    if (mobileView === "chat" && activeConversation) {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-none border-b border-border px-4 py-3 bg-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold truncate">
                {activeConversation.contacts?.first_name} {activeConversation.contacts?.last_name}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleShowDetails}>
              <User className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatWindow conversation={activeConversation} onConversationUpdated={handleSelectConversation} />
          </div>
        </div>
      );
    }

    // Mobile: List View
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-none border-b border-border px-4 py-3 bg-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Caixa de Entrada</h2>
            <div className="text-sm text-muted-foreground">
              {totalActiveCount} ativas
            </div>
          </div>
          
          {/* AI Mode Tabs - Compact for mobile */}
          <Tabs value={filter} onValueChange={(value) => navigate(`/inbox?filter=${value}`)}>
            <TabsList className="w-full">
              <TabsTrigger value="ai_queue" className="flex-1 text-xs gap-1">
                🤖 IA
                {aiQueueCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-xs">
                    {aiQueueCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="human_queue" className="flex-1 text-xs gap-1">
                👤 Humano
                {humanQueueCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-xs">
                    {humanQueueCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-1 text-xs">Todas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            conversations={orderedConversations ?? []}
            activeConversationId={activeConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            isLoading={isPageLoading}
          />
        </div>
      </div>
    );
  }

  // Desktop Layout - 4 Columns Fixed (Octa style)
  return (
    <div className="flex h-full overflow-hidden min-w-0">
      {/* Filter Sidebar - fixed width */}
      <div className="w-60 flex-shrink-0 border-r border-border" data-tour="inbox-filters">
        <InboxSidebar counts={sidebarCounts} />
      </div>
      
      {/* Conversation List - fixed width, increased to w-80 for better spacing */}
      <div className="w-80 lg:w-96 flex-shrink-0 border-r border-border flex flex-col" data-tour="inbox-conversation-list">
        {/* Mini Header with filters - more padding for breathing room */}
        <div className="flex-none border-b border-border px-4 py-3 bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">Conversas</h3>
              <BroadcastAIQueueButton queueCount={aiQueueCount} filter={filter} />
            </div>
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={toggleSelectionMode}
              className="h-7 gap-1.5 text-xs"
            >
              {selectionMode ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  Selecionar
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {orderedConversations.length} de {displayTotalCount} conversa{displayTotalCount !== 1 ? 's' : ''}
              {filters.waitingTime && filters.waitingTime !== 'all' && filters.waitingTime !== 'newest' && filters.waitingTime !== 'oldest' && (
                <span className="ml-1 text-warning">
                  (filtrado por tempo)
                </span>
              )}
            </span>
          </div>
          <InboxFilterPopover filters={filters} onFiltersChange={setFilters} />
        </div>
        
        {/* Active filter chips - visible outside popover */}
        <ActiveFilterChips filters={filters} onFiltersChange={setFilters} />
        
        {/* Bulk Actions Bar for waiting_human conversations */}
        {filter === 'human_queue' && !selectionMode && (
          <BulkActionsBar
            selectedIds={[]}
            onClearSelection={() => {}}
            waitingHumanCount={orderedConversations.filter(c => c.ai_mode === 'waiting_human').length}
            waitingHumanIds={orderedConversations.filter(c => c.ai_mode === 'waiting_human').map(c => c.id)}
          />
        )}
        
        {orderedConversations.length === 0 && !isPageLoading && (
          <div className="flex-none px-3 py-2 bg-warning/10 border-b border-warning/30">
            <p className="text-xs text-warning-foreground">
              Nenhuma conversa encontrada com essa combinação de filtros.
              {(filters.channels.length > 0 || filters.tags.length > 0 || filters.assignedTo || filters.aiMode) && (
                <span className="ml-1">Tente remover algum filtro acima.</span>
              )}
              {sidebarCounts.closed > 0 && !isArchived && (
                <button 
                  onClick={() => navigate('/inbox?filter=archived')}
                  className="ml-1 underline hover:no-underline font-medium"
                >
                  Ver {sidebarCounts.closed} encerradas
                </button>
              )}
            </p>
          </div>
        )}
        
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={orderedConversations}
            activeConversationId={activeConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            isLoading={isPageLoading}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </div>
      </div>
      
      {/* Chat Window - expands to fill remaining space */}
      <div className="flex-1 min-w-0 border-r border-border" data-tour="inbox-chat-area">
        <ChatWindow 
          conversation={activeConversation} 
          isContactPanelOpen={isContactPanelOpen}
          onToggleContactPanel={() => setIsContactPanelOpen(!isContactPanelOpen)}
          onConversationUpdated={handleSelectConversation}
        />
      </div>
      
      {/* Contact Details - fixed width, collapsible */}
      {isContactPanelOpen && (
        <div className="w-72 flex-shrink-0" data-tour="inbox-contact-panel">
          <ContactDetailsSidebar conversation={activeConversation} />
        </div>
      )}

      {/* Bulk Distribute Bar - floating at bottom */}
      <InboxBulkDistributeBar
        selectedCount={selectedIds.size}
        totalCount={orderedConversations.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onDistribute={() => setShowDistributeDialog(true)}
        onReactivateAI={handleBulkReactivateAI}
        onCloseConversations={handleBulkCloseConversations}
        isReactivating={bulkReactivate.isPending}
        isClosing={bulkClose.isPending}
      />

      {/* Bulk Distribute Dialog */}
      <InboxBulkDistributeDialog
        open={showDistributeDialog}
        onOpenChange={setShowDistributeDialog}
        conversationIds={Array.from(selectedIds)}
        onSuccess={handleClearSelection}
      />
    </div>
  );
}
