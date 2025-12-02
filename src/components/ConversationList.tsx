import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationListItem } from "@/components/ConversationListItem";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact;
  department_data?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
  } | null;
};

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
}

// FASE 4: Lista de conversas com SLA visual e contagem de não lidas
export default function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
}: ConversationListProps) {
  // Hook para buscar contagem de não lidas de todas as conversas
  const conversationIds = conversations.map(c => c.id);
  const { data: unreadCounts = {} } = useUnreadCount(conversationIds);

  return (
    <div className="w-72 lg:w-80 shrink-0 border-r bg-card border-border flex flex-col h-full overflow-hidden">
      <div className="flex-none p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
        {conversations.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            Nenhuma conversa ainda
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conversation, index) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversationId === conversation.id}
                onClick={() => onSelectConversation(conversation)}
                index={index}
                unreadCount={unreadCounts[conversation.id] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
