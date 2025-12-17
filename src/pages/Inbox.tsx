import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useInboxView, useInboxCounts, type InboxFilters as InboxViewFiltersType } from "@/hooks/useInboxView";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartments } from "@/hooks/useDepartments";
import { useTeams, useUserTeams } from "@/hooks/useTeams";
import { useTags } from "@/hooks/useTags";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import ContactDetailsSidebar from "@/components/ContactDetailsSidebar";
import InboxFilterPopover, { type InboxFilters } from "@/components/inbox/InboxFilterPopover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, User, Search, Tag, X } from "lucide-react";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
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

// Componente de dropdown de tags com pesquisa
interface TagFilterDropdownProps {
  tags: Array<{ id: string; name: string; color: string | null }>;
  selectedTagId: string | null;
  onSelect: (tagId: string | null) => void;
}

function TagFilterDropdown({ tags, selectedTagId, onSelect }: TagFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearch("");
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tag className="h-4 w-4" />
          {selectedTag ? (
            <>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedTag.color || 'hsl(var(--muted))' }}
              />
              <span className="max-w-24 truncate">{selectedTag.name}</span>
              <X
                className="h-3 w-3 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                }}
              />
            </>
          ) : (
            "Tags"
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 bg-popover border border-border z-50" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs pl-7"
          />
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filteredTags.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              {search ? "Nenhuma tag encontrada" : "Nenhuma tag cadastrada"}
            </p>
          ) : (
            filteredTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => {
                  onSelect(selectedTagId === tag.id ? null : tag.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 p-2 rounded text-sm hover:bg-muted transition-colors ${
                  selectedTagId === tag.id ? "bg-muted" : ""
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color || 'hsl(var(--muted))' }}
                />
                <span className="truncate">{tag.name}</span>
                {selectedTagId === tag.id && (
                  <span className="ml-auto text-primary">✓</span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  const { data: counts } = useInboxCounts();
  
  // Use original hook to get full conversation data when selected
  const { data: conversations, isLoading: convLoading } = useConversations();
  
  const { data: departments } = useDepartments();
  const { data: teams } = useTeams();
  const { data: userTeams } = useUserTeams(user?.id);
  const { data: conversationTags } = useTags('conversation');

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("filter", value);
    params.delete("dept");
    params.delete("team");
    navigate(`/inbox?${params.toString()}`);
  };

  const handleDepartmentFilter = (deptId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (deptId) {
      params.set("dept", deptId);
      params.delete("team");
    } else {
      params.delete("dept");
    }
    navigate(`/inbox?${params.toString()}`);
  };

  const handleTeamFilter = (teamId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (teamId) {
      params.set("team", teamId);
      params.delete("dept");
      params.delete("tag");
    } else {
      params.delete("team");
    }
    navigate(`/inbox?${params.toString()}`);
  };

  const handleTagFilter = (tagId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (tagId) {
      params.set("tag", tagId);
      params.delete("dept");
      params.delete("team");
    } else {
      params.delete("tag");
    }
    navigate(`/inbox?${params.toString()}`);
  };

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

    // Apply team filter (if user is manager of a team or member)
    if (teamFilter) {
      // For now, team filter would need team_members lookup
      // This is a placeholder for team-based filtering
    }

    // Apply AI mode filter
    switch (filter) {
      case "ai_queue":
        return result.filter(c => c.ai_mode === 'autopilot');
      
      case "human_queue":
        if (role === 'admin' || role === 'manager' || role === 'support_manager' || role === 'cs_manager') {
          return result.filter(c => c.ai_mode === 'copilot' || c.ai_mode === 'disabled');
        }
        return result.filter(c => 
          (c.ai_mode === 'copilot' || c.ai_mode === 'disabled') &&
          c.assigned_to === user?.id
        );
      
      case "my_team":
        // Show conversations from team members
        if (userTeams && userTeams.length > 0) {
          // Filter by team members - need to implement
          return result.filter(c => c.status !== 'closed');
        }
        return [];
      
      case "archived":
        return result.filter(c => c.status === "closed");
      
      default:
        return result.filter(c => c.status !== 'closed');
    }
  }, [conversations, filter, departmentFilter, teamFilter, user?.id, role, userTeams]);

  // Use optimized counts from inbox_view
  const aiQueueCount = counts?.aiQueue || 0;
  const humanQueueCount = counts?.humanQueue || 0;
  const totalActiveCount = (counts?.aiQueue || 0) + (counts?.humanQueue || 0);
  const slaCriticalCount = counts?.slaCritical || 0;
  
  const currentFilterCount = filteredConversations.length;
  const hasHiddenConversations = currentFilterCount === 0 && totalActiveCount > 0;

  const activeDepartments = departments?.filter((d) => d.is_active) || [];
  
  // Check if user is a team manager
  const isTeamManager = teams?.some(t => t.manager_id === user?.id);
  const showTeamTab = isTeamManager || (userTeams && userTeams.length > 0);


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
          <Tabs value={filter} onValueChange={handleFilterChange}>
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

  // Desktop Layout - 3 Columns
  return (
    <div className="flex flex-col h-full overflow-hidden min-w-0">
      <div className="flex-none border-b-2 border-slate-200 dark:border-border px-4 py-3 bg-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Caixa de Entrada</h2>
          <div className="text-sm text-muted-foreground">
            {totalActiveCount} {totalActiveCount === 1 ? 'conversa ativa' : 'conversas ativas'}
          </div>
        </div>
        
        {/* Advanced Filters */}
        <div className="mb-3">
          <InboxFilterPopover filters={filters} onFiltersChange={setFilters} />
        </div>
        
        {hasHiddenConversations && (
          <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Nenhuma conversa neste filtro, mas há <strong>{totalActiveCount}</strong> conversa(s) em outras abas
            </p>
          </div>
        )}
        
        {/* AI Mode Tabs */}
        <Tabs value={filter} onValueChange={handleFilterChange} className="mb-3">
          <TabsList>
            <TabsTrigger value="ai_queue" className="gap-2">
              🤖 Fila IA
              {aiQueueCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                  {aiQueueCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="human_queue" className="gap-2">
              👤 Fila Humana
              {humanQueueCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                  {humanQueueCount}
                </Badge>
              )}
            </TabsTrigger>
            {showTeamTab && (
              <TabsTrigger value="my_team" className="gap-2">
                👥 Meu Time
              </TabsTrigger>
            )}
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="archived">Arquivadas</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Department & Team Filters - Separated Sections */}
        <div className="flex gap-4 flex-wrap items-start">
          {/* Departamentos */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Departamentos</span>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={!departmentFilter && !teamFilter ? "default" : "outline"}
                onClick={() => {
                  handleDepartmentFilter(null);
                  handleTeamFilter(null);
                }}
              >
                Todos
              </Button>
              {activeDepartments.map((dept) => (
                <Button
                  key={dept.id}
                  size="sm"
                  variant={departmentFilter === dept.id ? "default" : "outline"}
                  onClick={() => handleDepartmentFilter(dept.id)}
                  style={{
                    borderColor: departmentFilter === dept.id ? dept.color || undefined : undefined,
                  }}
                >
                  {dept.name}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Times - Seção separada com estilo diferenciado */}
          {teams && teams.length > 0 && (
            <div className="flex flex-col gap-1.5 border-l border-border pl-4">
              <span className="text-xs font-medium text-muted-foreground">Times</span>
              <div className="flex gap-2 flex-wrap">
                {teams.map((team) => (
                  <Button
                    key={team.id}
                    size="sm"
                    variant={teamFilter === team.id ? "default" : "outline"}
                    onClick={() => handleTeamFilter(team.id)}
                    className={teamFilter !== team.id ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40" : ""}
                    style={{
                      borderColor: teamFilter === team.id ? team.color || undefined : undefined,
                    }}
                  >
                    👥 {team.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Tags - Dropdown com pesquisa */}
          {conversationTags && conversationTags.length > 0 && (
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <TagFilterDropdown
                tags={conversationTags}
                selectedTagId={tagFilter}
                onSelect={handleTagFilter}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Resizable 3-Column Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Conversation List Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <ConversationList
            conversations={filteredConversations}
            activeConversationId={activeConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            isLoading={inboxLoading || convLoading}
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        {/* Chat Window Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <ChatWindow conversation={activeConversation} />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        {/* Contact Details Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <ContactDetailsSidebar conversation={activeConversation} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
