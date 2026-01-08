import { useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";

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

  // Use optimized counts from inbox_view
  const totalActiveCount = (counts?.total || 0);
  const aiQueueCount = counts?.aiQueue || 0;
  const humanQueueCount = counts?.humanQueue || 0;
  
  const currentFilterCount = filteredConversations.length;
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
    archived: 0,
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
      <div className="w-56 flex-shrink-0 border-r border-border">
        <InboxSidebar counts={sidebarCounts} />
      </div>
      
      {/* Conversation List - fixed width */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        {/* Mini Header with filters */}
        <div className="flex-none border-b border-border px-3 py-2 bg-card">
          <InboxFilterPopover filters={filters} onFiltersChange={setFilters} />
        </div>
        
        {hasHiddenConversations && (
          <div className="flex-none px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ Nenhuma conversa neste filtro
            </p>
          </div>
        )}
        
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={filteredConversations}
            activeConversationId={activeConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            isLoading={inboxLoading || convLoading}
          />
        </div>
      </div>
      
      {/* Chat Window - expands to fill remaining space */}
      <div className="flex-1 min-w-0 border-r border-border">
        <ChatWindow conversation={activeConversation} />
      </div>
      
      {/* Contact Details - fixed width */}
      <div className="w-96 flex-shrink-0">
        <ContactDetailsSidebar conversation={activeConversation} />
      </div>
    </div>
  );
}
