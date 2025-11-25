import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import ContactDetailsSidebar from "@/components/ContactDetailsSidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  const filter = searchParams.get("filter") || "ai_queue";
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const { data: conversations, isLoading } = useConversations();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("filter", value);
    navigate(`/inbox?${params.toString()}`);
  };

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    
    switch (filter) {
      case "ai_queue":
        // Fila IA: conversas em autopilot (IA respondendo sozinha)
        return conversations.filter(c => c.ai_mode === 'autopilot');
      
      case "human_queue":
        // Fila Humana: conversas em copilot ou disabled E atribuídas ao usuário atual
        return conversations.filter(c => 
          (c.ai_mode === 'copilot' || c.ai_mode === 'disabled') &&
          c.assigned_to === user?.id
        );
      
      case "archived":
        return conversations.filter(c => c.status === "closed");
      
      default:
        return conversations;
    }
  }, [conversations, filter, user?.id]);

  const aiQueueCount = conversations?.filter(c => c.ai_mode === 'autopilot').length || 0;
  const humanQueueCount = conversations?.filter(c => 
    (c.ai_mode === 'copilot' || c.ai_mode === 'disabled') && 
    c.assigned_to === user?.id
  ).length || 0;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-2xl font-bold text-foreground mb-4">Caixa de Entrada</h2>
        <Tabs value={filter} onValueChange={handleFilterChange}>
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
      </div>
      
      <div className="flex flex-1 overflow-hidden">
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
