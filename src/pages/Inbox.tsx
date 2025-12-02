import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useConversations, type ConversationFilters } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartments } from "@/hooks/useDepartments";
import { useTeams, useUserTeams } from "@/hooks/useTeams";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import ContactDetailsSidebar from "@/components/ContactDetailsSidebar";
import InboxFilterPopover, { type InboxFilters } from "@/components/inbox/InboxFilterPopover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
};

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  
  // Filter state
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);
  
  // Smart default filter based on role
  const defaultFilter = (role === 'admin' || role === 'manager') ? 'all' : 'human_queue';
  const filter = searchParams.get("filter") || defaultFilter;
  
  const departmentFilter = searchParams.get("dept");
  const teamFilter = searchParams.get("team");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  
  // Convert InboxFilters to ConversationFilters for the hook
  const conversationFilters: ConversationFilters = {
    ...filters,
    channels: filters.channels,
    status: filters.status,
  };
  
  const { data: conversations, isLoading } = useConversations(conversationFilters);
  const { data: departments } = useDepartments();
  const { data: teams } = useTeams();
  const { data: userTeams } = useUserTeams(user?.id);

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
    } else {
      params.delete("team");
    }
    navigate(`/inbox?${params.toString()}`);
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

  const aiQueueCount = conversations?.filter(c => 
    c.ai_mode === 'autopilot' && 
    (!departmentFilter || c.department === departmentFilter)
  ).length || 0;
  
  const humanQueueCount = conversations?.filter(c => {
    const isHumanMode = c.ai_mode === 'copilot' || c.ai_mode === 'disabled';
    const matchesDept = !departmentFilter || c.department === departmentFilter;
    
    if (role === 'admin' || role === 'manager' || role === 'support_manager' || role === 'cs_manager') {
      return isHumanMode && matchesDept;
    }
    
    return isHumanMode && c.assigned_to === user?.id && matchesDept;
  }).length || 0;

  const totalActiveCount = conversations?.filter(c => 
    c.status !== 'closed' &&
    (!departmentFilter || c.department === departmentFilter)
  ).length || 0;

  const currentFilterCount = filteredConversations.length;
  const hasHiddenConversations = currentFilterCount === 0 && totalActiveCount > 0;

  const activeDepartments = departments?.filter((d) => d.is_active) || [];
  
  // Check if user is a team manager
  const isTeamManager = teams?.some(t => t.manager_id === user?.id);
  const showTeamTab = isTeamManager || (userTeams && userTeams.length > 0);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
        </div>
      </div>
      
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ConversationList
          conversations={filteredConversations}
          activeConversationId={activeConversation?.id || null}
          onSelectConversation={setActiveConversation}
        />
        <ChatWindow conversation={activeConversation} />
        <ContactDetailsSidebar conversation={activeConversation} />
      </div>
    </div>
  );
}
