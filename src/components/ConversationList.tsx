import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
}

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
}: ConversationListProps) {
  return (
    <div className="w-80 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
      </div>
      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            Nenhuma conversa ainda
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={cn(
                  "w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left",
                  activeConversationId === conversation.id && "bg-accent"
                )}
              >
                <Avatar className="h-12 w-12 bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {conversation.contacts.first_name[0]}
                    {conversation.contacts.last_name[0]}
                  </span>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-foreground truncate">
                      {conversation.contacts.first_name}{" "}
                      {conversation.contacts.last_name}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.last_message_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={conversation.channel === "whatsapp" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {conversation.channel}
                    </Badge>
                    {conversation.status === "open" && (
                      <Badge variant="outline" className="text-xs">
                        Aberta
                      </Badge>
                    )}
                    {conversation.assigned_user && (
                      <Badge variant="secondary" className="text-xs">
                        {conversation.assigned_user.full_name}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
