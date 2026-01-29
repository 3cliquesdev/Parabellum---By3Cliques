import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useInboxView, useInboxCounts, type InboxFilters as InboxViewFiltersType, type InboxCounts } from "@/hooks/useInboxView";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartments } from "@/hooks/useDepartments";
import { useTeams, useUserTeams } from "@/hooks/useTeams";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import ContactDetailsSidebar from "@/components/ContactDetailsSidebar";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";
import InboxFilterPopover, { type InboxFilters } from "@/components/inbox/InboxFilterPopover";
import { BulkActionsBar } from "@/components/inbox/BulkActionsBar";
import { InboxBulkDistributeBar } from "@/components/inbox/InboxBulkDistributeBar";
import { InboxBulkDistributeDialog } from "@/components/inbox/InboxBulkDistributeDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, CheckSquare, X } from "lucide-react";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import { useBulkReactivateAI } from "@/hooks/useBulkReactivateAI";
import { useBulkCloseConversations } from "@/hooks/useBulkCloseConversations";

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
  const bulkReactivate = useBulkReactivateAI();
  const bulkClose = useBulkCloseConversations();
  
  // Smart default filter based on role
  const defaultFilter = (role === 'admin' || role === 'manager') ? 'all' : 'human_queue';
  const filter = searchParams.get("filter") || defaultFilter;
  
  const departmentFilter = searchParams.get("dept");
  const teamFilter = searchParams.get("team");
  const tagFilter = searchParams.get("tag");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  
  // Convert InboxFilters to InboxViewFilters for the optimized hook
  const inboxViewFilters: InboxViewFiltersType = {
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
    tagId: tagFilter || undefined,
  };
  
  // Use optimized inbox_view for list (fast)
  const { data: inboxItems, isLoading: inboxLoading } = useInboxView(inboxViewFilters);
  const { data: counts } = useInboxCounts(user?.id);
  
  // Use original hook to get full conversation data when selected
  const { data: conversations, isLoading: convLoading } = useConversations();
  
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

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    
    let result = conversations;

    // Apply department filter
    if (departmentFilter) {
      result = result.filter(c => c.department === departmentFilter);
    }

    // Apply tag filter - need to check conversation_tags
    // For now, tag filter is handled by the inboxViewFilters

    // Apply filters based on URL params
    switch (filter) {
      case "ai_queue":
        return result.filter(c => c.ai_mode === 'autopilot' && c.status !== 'closed');
      
      case "human_queue":
        if (role === 'admin' || role === 'manager' || role === 'support_manager' || role === 'cs_manager') {
          return result.filter(c => c.ai_mode !== 'autopilot' && c.status !== 'closed');
        }
        return result.filter(c => 
          c.ai_mode !== 'autopilot' &&
          c.assigned_to === user?.id &&
          c.status !== 'closed'
        );
      
      case "mine":
        return result.filter(c => c.assigned_to === user?.id && c.status !== 'closed');
      
      case "sla":
        // SLA critical/warning - would need sla_status field
        return result.filter(c => c.status !== 'closed');
      
      case "not_responded":
        // Last message from contact - would need last_sender_type field
        return result.filter(c => c.status !== 'closed');
      
      case "unassigned":
        return result.filter(c => !c.assigned_to && c.status !== 'closed');
      
      case "archived":
        return result.filter(c => c.status === "closed");
      
      default:
        return result.filter(c => c.status !== 'closed');
    }
  }, [conversations, filter, departmentFilter, user?.id, role]);

  // Ordenação: usar a prioridade do inbox_view (mais antigas primeiro)
  // para refletir o SLA/fila corretamente, sem mudar a fonte de dados (conversations).
  const orderedConversations = useMemo(() => {
    if (!filteredConversations) return [];
    if (!inboxItems || inboxItems.length === 0) return filteredConversations;

    const indexById = new Map<string, number>();
    for (let i = 0; i < inboxItems.length; i++) {
      indexById.set(inboxItems[i].conversation_id, i);
    }

    return [...filteredConversations].sort((a, b) => {
      const ia = indexById.get(a.id);
      const ib = indexById.get(b.id);
      if (ia == null && ib == null) return 0;
      if (ia == null) return 1;
      if (ib == null) return -1;
      return ia - ib;
    });
  }, [filteredConversations, inboxItems]);

  // Bulk selection handlers (after filteredConversations is defined)
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
      bulkClose.mutate(Array.from(selectedIds), {
        onSuccess: handleClearSelection
      });
    }
  }, [selectedIds, bulkClose, handleClearSelection]);

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

  // Default sidebar counts
  const sidebarCounts: InboxCounts = counts || {
    total: 0,
    mine: 0,
    aiQueue: 0,
    humanQueue: 0,
    slaCritical: 0,
    slaWarning: 0,
    notResponded: 0,
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
            <ChatWindow conversation={activeConversation} />
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
            conversations={filteredConversations}
            activeConversationId={activeConversation?.id || null}
            onSelectConversation={handleSelectConversation}
          />
        </div>
      </div>
    );
  }

  // Desktop Layout - 4 Columns Fixed (Octa style)
  return (
    <div className="flex h-full overflow-hidden min-w-0">
      {/* Filter Sidebar - fixed width */}
      <div className="w-56 flex-shrink-0 border-r border-border" data-tour="inbox-filters">
        <InboxSidebar counts={sidebarCounts} />
      </div>
      
      {/* Conversation List - fixed width, increased to w-80 for better spacing */}
      <div className="w-80 lg:w-96 flex-shrink-0 border-r border-border flex flex-col" data-tour="inbox-conversation-list">
        {/* Mini Header with filters - more padding for breathing room */}
        <div className="flex-none border-b border-border px-4 py-3 bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">Conversas</h3>
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
            <span className="text-xs text-muted-foreground">
              {filteredConversations.length} conversa{filteredConversations.length !== 1 ? 's' : ''}
            </span>
          </div>
          <InboxFilterPopover filters={filters} onFiltersChange={setFilters} />
        </div>
        
        {/* Bulk Actions Bar for waiting_human conversations */}
        {filter === 'human_queue' && !selectionMode && (
          <BulkActionsBar
            selectedIds={[]}
            onClearSelection={() => {}}
            waitingHumanCount={orderedConversations.filter(c => c.ai_mode === 'waiting_human').length}
            waitingHumanIds={orderedConversations.filter(c => c.ai_mode === 'waiting_human').map(c => c.id)}
          />
        )}
        
        {hasHiddenConversations && (
          <div className="flex-none px-3 py-2 bg-warning/10 border-b border-warning/30">
            <p className="text-xs text-warning-foreground">
              Nenhuma conversa neste filtro.
              {sidebarCounts.closed > 0 && (
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
            isLoading={inboxLoading || convLoading}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </div>
      </div>
      
      {/* Chat Window - expands to fill remaining space */}
      <div className="flex-1 min-w-0 border-r border-border" data-tour="inbox-chat-area">
        <ChatWindow conversation={activeConversation} />
      </div>
      
      {/* Contact Details - fixed width */}
      <div className="w-72 flex-shrink-0" data-tour="inbox-contact-panel">
        <ContactDetailsSidebar conversation={activeConversation} />
      </div>

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
