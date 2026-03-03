import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartments } from "@/hooks/useDepartments";
import { useTeams } from "@/hooks/useTeams";
import { useTags } from "@/hooks/useTags";
import { useAgentConversations } from "@/hooks/useAgentConversations";
import { useManageAvailabilityStatus } from "@/hooks/useManageAvailabilityStatus";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BulkRedistributeDialog } from "@/components/BulkRedistributeDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MessageCircle, 
  User, 
  Clock, 
  MessageSquare, 
  UserX, 
  Bot, 
  Users, 
  ChevronDown,
  CheckCircle2,
  Tag,
  Search,
  Building2,
  AlertTriangle,
  UserCog,
  ArrowRightLeft,
  MoreVertical
} from "lucide-react";

interface InboxSidebarCounts {
  total: number;
  mine: number;
  slaCritical: number;
  slaWarning: number;
  notResponded: number;
  myNotResponded: number; // Conversas do usuário atual aguardando resposta
  unassigned: number;
  aiQueue: number;
  humanQueue: number;
  closed: number;
  byDepartment: Array<{ id: string; name: string; color: string | null; count: number }>;
  byTag: Array<{ id: string; name: string; color: string | null; count: number }>;
}

interface InboxSidebarProps {
  counts: InboxSidebarCounts;
}

interface FilterItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  variant?: "default" | "warning" | "danger";
}

function FilterItem({ icon, label, count, isActive, onClick, variant = "default" }: FilterItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
        isActive 
          ? "bg-primary/10 text-primary border-l-2 border-primary font-medium" 
          : "hover:bg-muted/50 text-foreground",
        variant === "warning" && !isActive && "text-yellow-600 dark:text-yellow-400",
        variant === "danger" && !isActive && "text-red-600 dark:text-red-400"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <Badge 
        variant={isActive ? "default" : "secondary"} 
        className={cn(
          "min-w-6 justify-center shrink-0",
          count === 0 && "opacity-60",
          variant === "danger" && !isActive && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          variant === "warning" && !isActive && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        )}
      >
        {count}
      </Badge>
    </button>
  );
}

interface AgentsSectionProps {
  agentStats: Array<{
    agentId: string;
    agentName: string;
    avatarUrl: string | null;
    status: string;
    conversationCount: number;
    slaCriticalCount: number;
    slaWarningCount: number;
  }>;
  agentsOpen: boolean;
  setAgentsOpen: (open: boolean) => void;
  setRedistributeAgent: (agent: { id: string; name: string } | null) => void;
  currentAgent: string | null;
  onAgentClick: (agentId: string) => void;
}

function AgentsSection({ agentStats, agentsOpen, setAgentsOpen, setRedistributeAgent, currentAgent, onAgentClick }: AgentsSectionProps) {
  const manageStatus = useManageAvailabilityStatus();

  const handleStatusChange = (agentId: string, newStatus: 'online' | 'busy' | 'offline') => {
    manageStatus.mutate({ user_id: agentId, new_status: newStatus });
  };

  return (
    <Collapsible open={agentsOpen} onOpenChange={setAgentsOpen} className="px-2 mt-4">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <UserCog className="h-3.5 w-3.5" />
          Por Atendente
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform", agentsOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
        {[...agentStats]
          .sort((a, b) => {
            const statusOrder = { online: 0, busy: 1, offline: 2 };
            return (statusOrder[a.status as keyof typeof statusOrder] ?? 2) - (statusOrder[b.status as keyof typeof statusOrder] ?? 2);
          })
          .map((agent) => {
          const hasWarning = agent.slaWarningCount > 0;
          const hasCritical = agent.slaCriticalCount > 0;
          
          const isAgentActive = currentAgent === agent.agentId;
          
          return (
            <div
              key={agent.agentId}
              onClick={() => onAgentClick(agent.agentId)}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors",
                isAgentActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary font-medium"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={agent.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {agent.agentName?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 transition-all",
                          agent.status === "online" && "bg-green-500",
                          agent.status === "busy" && "bg-yellow-500",
                          agent.status === "offline" && "bg-gray-400"
                        )}
                        title="Clique para alterar status"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[160px]">
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(agent.agentId, 'online')}
                        className="gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        Online
                        {agent.status === 'online' && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(agent.agentId, 'busy')}
                        className="gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                        Ocupado
                        {agent.status === 'busy' && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(agent.agentId, 'offline')}
                        className="gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                        Offline (Férias)
                        {agent.status === 'offline' && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span className="text-sm truncate">{agent.agentName.split(' ')[0]}</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                {hasCritical && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
                    {agent.slaCriticalCount}
                  </Badge>
                )}
                {hasWarning && !hasCritical && (
                  <Badge className="h-5 min-w-5 px-1 text-[10px] bg-orange-500">
                    {agent.slaWarningCount}
                  </Badge>
                )}
                <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                  {agent.conversationCount}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <DropdownMenuItem 
                      onClick={() => setRedistributeAgent({ id: agent.agentId, name: agent.agentName })}
                      className="gap-2"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      Redistribuir conversas
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleStatusChange(agent.agentId, 'online')}
                      className="gap-2"
                      disabled={agent.status === 'online'}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      Colocar Online
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleStatusChange(agent.agentId, 'busy')}
                      className="gap-2"
                      disabled={agent.status === 'busy'}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      Colocar Ocupado
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleStatusChange(agent.agentId, 'offline')}
                      className="gap-2"
                      disabled={agent.status === 'offline'}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      Colocar Offline
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function InboxSidebar({ counts }: InboxSidebarProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  const { data: departments } = useDepartments();
  const { data: teams } = useTeams();
  const { data: tags } = useTags("conversation");
  const { data: agentStats } = useAgentConversations();

  const [groupsOpen, setGroupsOpen] = useState(true);
  // Auto-abrir tags se há muitas (mais de 5)
  const [tagsOpen, setTagsOpen] = useState((tags?.length || 0) > 5);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [tagSearch, setTagSearch] = useState("");
  const [redistributeAgent, setRedistributeAgent] = useState<{ id: string; name: string } | null>(null);

  const isManagerOrAdmin = role === 'admin' || role === 'general_manager' || role === 'manager' || role === 'support_manager' || role === 'cs_manager' || role === 'financial_manager';

  const currentFilter = searchParams.get("filter") || "all";
  const currentDept = searchParams.get("dept");
  const currentTag = searchParams.get("tag");
  const currentAgent = searchParams.get("agent");

  const setFilter = (filter: string) => {
    const params = new URLSearchParams();
    params.set("filter", filter);
    navigate(`/inbox?${params.toString()}`);
  };

  const setDepartment = (deptId: string | null) => {
    const params = new URLSearchParams();
    if (deptId) {
      params.set("dept", deptId);
    }
    navigate(`/inbox?${params.toString()}`);
  };

  const setTag = (tagId: string | null) => {
    const params = new URLSearchParams();
    if (tagId) {
      params.set("tag", tagId);
    }
    navigate(`/inbox?${params.toString()}`);
  };

  const setAgent = (agentId: string) => {
    const params = new URLSearchParams();
    if (currentAgent === agentId) {
      // Toggle off — go back to all
    } else {
      params.set("agent", agentId);
    }
    navigate(`/inbox?${params.toString()}`);
  };

  const activeDepartments = departments?.filter(d => d.is_active) || [];
  const filteredTags = tags?.filter(t => 
    t.name.toLowerCase().includes(tagSearch.toLowerCase())
  ) || [];

  const isFilterActive = (filter: string) => currentFilter === filter && !currentDept && !currentTag && !currentAgent;

  return (
    <div className="flex flex-col h-full bg-muted/30 border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Conversas
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Main Filters */}
          <FilterItem
            icon={<MessageSquare className="h-4 w-4" />}
            label="Todas"
            count={counts.total}
            isActive={isFilterActive("all")}
            onClick={() => setFilter("all")}
          />
          
          <FilterItem
            icon={<User className="h-4 w-4" />}
            label="Minhas"
            count={counts.mine}
            isActive={isFilterActive("mine")}
            onClick={() => setFilter("mine")}
          />

          {/* Sub-item: Não respondidas (apenas do usuário atual) */}
          <div className="pl-4">
            <FilterItem
              icon={<Clock className="h-4 w-4" />}
              label="Não respondidas"
              count={counts.myNotResponded ?? 0}
              isActive={isFilterActive("not_responded")}
              onClick={() => setFilter("not_responded")}
              variant="warning"
            />
          </div>

          <FilterItem
            icon={<AlertTriangle className="h-4 w-4" />}
            label="SLA Excedido"
            count={counts.slaCritical}
            isActive={isFilterActive("sla")}
            onClick={() => setFilter("sla")}
            variant="danger"
          />

          <FilterItem
            icon={<UserX className="h-4 w-4" />}
            label="Não atribuídas"
            count={counts.unassigned}
            isActive={isFilterActive("unassigned")}
            onClick={() => setFilter("unassigned")}
          />

          <div className="h-px bg-border my-2" />

          <FilterItem
            icon={<Bot className="h-4 w-4" />}
            label="Fila IA"
            count={counts.aiQueue}
            isActive={isFilterActive("ai_queue")}
            onClick={() => setFilter("ai_queue")}
          />

          <FilterItem
            icon={<Users className="h-4 w-4" />}
            label="Fila Humana"
            count={counts.humanQueue}
            isActive={isFilterActive("human_queue")}
            onClick={() => setFilter("human_queue")}
          />

          <div className="h-px bg-border my-2" />

          {/* Encerradas with highlight when there are closed conversations */}
          <div className="relative">
            <FilterItem
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Encerradas"
              count={counts.closed}
              isActive={isFilterActive("archived")}
              onClick={() => setFilter("archived")}
            />
            {counts.closed > 0 && !isFilterActive("archived") && (
              <div className="absolute -top-1 -right-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
              </div>
            )}
          </div>
          
          {/* Closed conversations hint */}
          {counts.closed > 0 && !isFilterActive("archived") && (
            <p className="px-3 py-1 text-[10px] text-muted-foreground italic">
              💡 {counts.closed} conversa{counts.closed > 1 ? 's' : ''} encerrada{counts.closed > 1 ? 's' : ''} por inatividade
            </p>
          )}
        </div>

        {/* Departments Section */}
        {activeDepartments.length > 0 && (
          <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen} className="px-2 mt-4">
            <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" />
                Departamentos
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", groupsOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {activeDepartments.map((dept) => {
                const deptCount = counts.byDepartment.find(d => d.id === dept.id)?.count || 0;
                const isActive = currentDept === dept.id;
                
                return (
                  <button
                    key={dept.id}
                    onClick={() => setDepartment(isActive ? null : dept.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary border-l-2 border-primary font-medium" 
                        : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: dept.color || 'hsl(var(--muted))' }}
                      />
                      <span className="truncate">{dept.name}</span>
                    </div>
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={cn("min-w-6 justify-center", deptCount === 0 && "opacity-60")}
                    >
                      {deptCount}
                    </Badge>
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Tags Section */}
        {tags && tags.length > 0 && (
          <Collapsible open={tagsOpen} onOpenChange={setTagsOpen} className="px-2 mt-4">
            <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5" />
                Tags
                {(tags?.length || 0) > 5 && (
                  <span className="text-[10px] text-muted-foreground font-normal normal-case">
                    ({tags?.length})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Mostrar ícone de busca inline quando colapsado */}
                {!tagsOpen && (tags?.length || 0) > 5 && (
                  <Search className="h-3 w-3 text-muted-foreground" />
                )}
                <ChevronDown className={cn("h-4 w-4 transition-transform", tagsOpen && "rotate-180")} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {/* Campo de busca sempre visível quando aberto */}
              <div className="px-3 mb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tag..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="h-7 text-xs pl-7"
                    autoFocus={tagsOpen && (tags?.length || 0) > 10}
                  />
                </div>
              </div>
              {filteredTags.slice(0, 10).map((tag) => {
                const tagCount = counts.byTag.find(t => t.id === tag.id)?.count || 0;
                const isActive = currentTag === tag.id;
                
                return (
                  <button
                    key={tag.id}
                    onClick={() => setTag(isActive ? null : tag.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary border-l-2 border-primary font-medium" 
                        : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: tag.color || 'hsl(var(--muted))' }}
                      />
                      <span className="truncate">{tag.name}</span>
                    </div>
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={cn("min-w-6 justify-center", tagCount === 0 && "opacity-60")}
                    >
                      {tagCount}
                    </Badge>
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Agents Section - Only for managers/admins */}
        {isManagerOrAdmin && agentStats && agentStats.length > 0 && (
          <AgentsSection 
            agentStats={agentStats}
            agentsOpen={agentsOpen}
            setAgentsOpen={setAgentsOpen}
            setRedistributeAgent={setRedistributeAgent}
            currentAgent={currentAgent}
            onAgentClick={setAgent}
          />
        )}

        <div className="h-4" />
      </ScrollArea>

      {/* Bulk Redistribute Dialog */}
      {redistributeAgent && (
        <BulkRedistributeDialog
          open={!!redistributeAgent}
          onOpenChange={(open) => !open && setRedistributeAgent(null)}
          agentId={redistributeAgent.id}
          agentName={redistributeAgent.name}
        />
      )}
    </div>
  );
}
