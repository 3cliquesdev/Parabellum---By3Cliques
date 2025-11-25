import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartments } from "@/hooks/useDepartments";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import ContactDetailsSidebar from "@/components/ContactDetailsSidebar";
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

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  
  // Filtro padrão inteligente baseado em role
  const defaultFilter = (role === 'admin' || role === 'manager') ? 'all' : 'human_queue';
  const filter = searchParams.get("filter") || defaultFilter;
  
  const departmentFilter = searchParams.get("dept");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const { data: conversations, isLoading } = useConversations();
  const { data: departments } = useDepartments();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("filter", value);
    params.delete("dept"); // Remove department filter when changing main filter
    navigate(`/inbox?${params.toString()}`);
  };

  const handleDepartmentFilter = (deptId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (deptId) {
      params.set("dept", deptId);
    } else {
      params.delete("dept");
    }
    navigate(`/inbox?${params.toString()}`);
  };

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    
    let result = conversations;

    // Aplicar filtro de departamento primeiro (se houver)
    if (departmentFilter) {
      result = result.filter(c => c.department === departmentFilter);
    }

    // Depois aplicar filtro de modo AI
    switch (filter) {
      case "ai_queue":
        // Fila IA: conversas em autopilot (IA respondendo sozinha)
        return result.filter(c => c.ai_mode === 'autopilot');
      
      case "human_queue":
        // Fila Humana: conversas em copilot ou disabled E atribuídas ao usuário atual
        return result.filter(c => 
          (c.ai_mode === 'copilot' || c.ai_mode === 'disabled') &&
          c.assigned_to === user?.id
        );
      
      case "archived":
        return result.filter(c => c.status === "closed");
      
      default:
        // Mostrar todas EXCETO arquivadas (status !== 'closed')
        return result.filter(c => c.status !== 'closed');
    }
  }, [conversations, filter, departmentFilter, user?.id]);

  const aiQueueCount = conversations?.filter(c => 
    c.ai_mode === 'autopilot' && 
    (!departmentFilter || c.department === departmentFilter)
  ).length || 0;
  
  const humanQueueCount = conversations?.filter(c => 
    (c.ai_mode === 'copilot' || c.ai_mode === 'disabled') && 
    c.assigned_to === user?.id &&
    (!departmentFilter || c.department === departmentFilter)
  ).length || 0;

  const totalActiveCount = conversations?.filter(c => 
    c.status !== 'closed' &&
    (!departmentFilter || c.department === departmentFilter)
  ).length || 0;

  const currentFilterCount = filteredConversations.length;
  const hasHiddenConversations = currentFilterCount === 0 && totalActiveCount > 0;

  const activeDepartments = departments?.filter((d) => d.is_active) || [];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Caixa de Entrada</h2>
          <div className="text-sm text-muted-foreground">
            {totalActiveCount} {totalActiveCount === 1 ? 'conversa ativa' : 'conversas ativas'}
          </div>
        </div>
        
        {hasHiddenConversations && (
          <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Nenhuma conversa neste filtro, mas há <strong>{totalActiveCount}</strong> conversa(s) em outras abas
            </p>
          </div>
        )}
        
        {/* Filtros de Modo AI */}
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
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="archived">Arquivadas</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filtros de Departamento */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={!departmentFilter ? "default" : "outline"}
            onClick={() => handleDepartmentFilter(null)}
          >
            🏢 Todos
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
