import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SentimentBadge } from "@/components/SentimentBadge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { useSentimentAnalysis, type Sentiment } from "@/hooks/useSentimentAnalysis";
import { useMessages } from "@/hooks/useMessages";
import { useEffect, useState, useRef } from "react";

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

function ConversationItem({ 
  conversation, 
  isActive, 
  onClick,
  index
}: { 
  conversation: Conversation; 
  isActive: boolean; 
  onClick: () => void;
  index: number;
}) {
  const { data: messages } = useMessages(conversation.id);
  const sentimentAnalysis = useSentimentAnalysis();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const hasAnalyzedRef = useRef(false);

  useEffect(() => {
    if (messages && messages.length > 0 && !sentiment && !hasAnalyzedRef.current) {
      hasAnalyzedRef.current = true;
      
      const customerMessages = messages
        .filter(m => m.sender_type === 'contact')
        .slice(-5);

      if (customerMessages.length > 0) {
        // Adicionar delay progressivo baseado no index para espaçar requisições
        const delay = index * 1500; // 1.5s entre cada análise
        
        setTimeout(() => {
          const formattedMessages = customerMessages.map(m => ({
            content: m.content,
            sender_type: m.sender_type as 'user' | 'contact'
          }));

          sentimentAnalysis.mutate(formattedMessages, {
            onSuccess: (result) => setSentiment(result),
            onError: () => {
              // Fallback para neutro em caso de rate limit
              setSentiment('neutro');
            }
          });
        }, delay);
      }
    }
  }, [messages, sentiment, index]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left relative",
        isActive && "bg-accent dark:bg-white/[0.05] border-l-2 border-primary"
      )}
    >
      <Avatar className={cn(
        "h-12 w-12 flex items-center justify-center",
        isActive ? "bg-primary/20 dark:bg-primary/10" : "bg-primary/10"
      )}>
        <span className={cn(
          "text-sm font-semibold",
          "text-primary"
        )}>
          {conversation.contacts?.first_name?.[0] || ''}
          {conversation.contacts?.last_name?.[0] || ''}
        </span>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className={cn(
            "font-medium truncate text-foreground"
          )}>
            {conversation.contacts?.first_name || 'Cliente'}{" "}
            {conversation.contacts?.last_name || ''}
          </p>
          <span className={cn(
            "text-xs text-muted-foreground"
          )}>
            {formatDistanceToNow(new Date(conversation.last_message_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={conversation.channel === "whatsapp" ? "success" : "secondary"}
            className="text-xs"
          >
            {conversation.channel === "whatsapp" ? "📱 WhatsApp" : conversation.channel}
          </Badge>
          {conversation.department_data && (
            <Badge 
              variant="outline" 
              className="text-xs border-2"
              style={{
                borderColor: conversation.department_data.color || undefined,
                color: conversation.department_data.color || undefined,
                backgroundColor: conversation.department_data.color 
                  ? `${conversation.department_data.color}15` 
                  : undefined,
              }}
            >
              🏢 {conversation.department_data.name}
            </Badge>
          )}
          {conversation.status === "open" && (
            <Badge variant="outline" className="text-xs">
              Aberta
            </Badge>
          )}
          {conversation.ai_mode && (
            <Badge 
              variant={
                conversation.ai_mode === 'autopilot' ? "default" : 
                conversation.ai_mode === 'copilot' ? "info" : 
                "secondary"
              }
              className="text-xs"
            >
              {conversation.ai_mode === 'autopilot' && "🤖 AI"}
              {conversation.ai_mode === 'copilot' && "🧠 Copilot"}
              {conversation.ai_mode === 'disabled' && "👤 Manual"}
            </Badge>
          )}
          {sentiment && <SentimentBadge sentiment={sentiment} className="text-xs" />}
          {conversation.assigned_user && (
            <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {conversation.assigned_user.full_name}
            </Badge>
          )}
          {/* FASE 4: Badge de Sessão Não Verificada para WhatsApp sem email */}
          {conversation.channel === 'whatsapp' && !conversation.contacts?.email && (
            <Badge variant="warning" className="text-xs">
              ⚠️ Sem email
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
}: ConversationListProps) {
  return (
    <div className="w-72 lg:w-80 shrink-0 border-r bg-card border-border flex flex-col h-full overflow-hidden">
      <div className="flex-none p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            Nenhuma conversa ainda
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conversation, index) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversationId === conversation.id}
                onClick={() => onSelectConversation(conversation)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
