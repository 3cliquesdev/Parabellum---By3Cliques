import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useConversations } from "@/hooks/useConversations";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import ContactDetailsSidebar from "@/components/ContactDetailsSidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact;
};

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filter = searchParams.get("filter") || "all";
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
      case "unread":
        // Para funcionar corretamente, precisaríamos buscar mensagens não lidas
        // Por ora, mantém o comportamento atual
        return conversations.filter(c => c.status === "open");
      case "archived":
        return conversations.filter(c => c.status === "closed");
      default:
        return conversations;
    }
  }, [conversations, filter]);

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
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="unread">Não Lidas</TabsTrigger>
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
