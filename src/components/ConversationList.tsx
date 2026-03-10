import { useCallback, useRef, useEffect, useState, useMemo, CSSProperties } from "react";
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
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

interface RowData {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  unreadCounts: Record<string, number>;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
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
  selectionMode,
  selectedIds,
  onToggleSelect,
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
      selectionMode={selectionMode}
      isSelected={selectedIds?.has(conversation.id)}
      onToggleSelect={onToggleSelect}
    />
  );
}

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  isLoading = false,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
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
    selectionMode,
    selectedIds,
    onToggleSelect,
  };

  // react-window v2 usa key por índice internamente. Quando a lista reordena (mesmo sem mudar
  // primeiro/último item) após transferências/redistribuições, pode ocorrer DOMException.
  // Forçar remount quando a ordem mudar (hash leve dos IDs) estabiliza.
  const listKey = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < conversations.length; i++) {
      const id = conversations[i]?.id ?? "";
      // Rolling hash simples baseado em alguns chars
      for (let j = 0; j < id.length; j += 4) {
        hash = (hash * 31 + id.charCodeAt(j)) | 0;
      }
    }
    return `${conversations.length}-${hash}`;
  }, [conversations]);

  return (
    <div className="w-full shrink-0 bg-card flex flex-col h-full overflow-hidden">
      <div ref={containerRef} className="flex-1 min-h-0">
        {isLoading ? (
          <ConversationListSkeleton count={8} />
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground space-y-2">
            <p className="font-medium">Nenhuma conversa encontrada</p>
            <p className="text-sm opacity-70">
              A combinação de filtros selecionada não retornou resultados.
            </p>
            <p className="text-xs opacity-50">
              Tente ampliar o período de datas ou remover alguns filtros.
            </p>
          </div>
        ) : (
          <List
            key={listKey}
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
