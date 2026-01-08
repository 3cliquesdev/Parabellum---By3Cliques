import { useCallback, useRef, useEffect, useState, CSSProperties } from "react";
import { List, RowComponentProps } from "react-window";
import { ConversationListItem } from "@/components/ConversationListItem";
import { ConversationListSkeleton } from "@/components/inbox/MessageSkeleton";
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
  isLoading?: boolean;
}

interface RowData {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  unreadCounts: Record<string, number>;
}

const ITEM_HEIGHT = 100;

// Row component for virtualized list
function ConversationRow({
  index,
  style,
  conversations,
  activeConversationId,
  onSelectConversation,
  unreadCounts,
}: RowComponentProps<RowData>) {
  const conversation = conversations[index];
  if (!conversation) return null;

  return (
    <ConversationListItem
      conversation={conversation}
      isActive={activeConversationId === conversation.id}
      onClick={() => onSelectConversation(conversation)}
      index={index}
      unreadCount={unreadCounts[conversation.id] || 0}
      style={style}
    />
  );
}

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  isLoading = false,
}: ConversationListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600);
  const conversationIds = conversations.map(c => c.id);
  const { data: unreadCounts = {} } = useUnreadCount(conversationIds);

  // Calculate list height based on container
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setListHeight(height > 0 ? height : 600);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateHeight);
      resizeObserver.disconnect();
    };
  }, []);

  const rowProps: RowData = {
    conversations,
    activeConversationId,
    onSelectConversation,
    unreadCounts,
  };

  return (
    <div className="w-72 lg:w-80 shrink-0 border-r bg-card border-border flex flex-col h-full overflow-hidden">
      <div className="flex-none p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
        {!isLoading && conversations.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0">
        {isLoading ? (
          <ConversationListSkeleton count={8} />
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            Nenhuma conversa ainda
          </div>
        ) : (
          <List
            rowComponent={ConversationRow}
            rowCount={conversations.length}
            rowHeight={ITEM_HEIGHT}
            rowProps={rowProps}
            overscanCount={3}
            style={{ height: listHeight, width: '100%' }}
          />
        )}
      </div>
    </div>
  );
}
