import { memo, useEffect, useState, useRef, CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon } from "@/components/ChannelIcon";
import { SentimentBadge } from "@/components/SentimentBadge";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInMinutes, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { useSentimentAnalysis, type Sentiment } from "@/hooks/useSentimentAnalysis";
import { supabase } from "@/integrations/supabase/client";
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

interface ConversationListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  index: number;
  unreadCount?: number;
  style?: CSSProperties;
}

// Calcular cor do indicador de SLA com níveis progressivos granulares
function getSLAColor(lastMessageAt: Date): { 
  color: string; 
  bgColor: string;
  urgency: "normal" | "attention" | "alert" | "urgent" | "critical";
  emoji: string;
} {
  const minutes = differenceInMinutes(new Date(), lastMessageAt);
  const hours = minutes / 60;
  
  // 0-15 min: Verde claro - Normal
  if (minutes < 15) {
    return { 
      color: "text-emerald-500", 
      bgColor: "bg-emerald-500/10",
      urgency: "normal",
      emoji: ""
    };
  }
  // 15-30 min: Verde escuro - Normal+
  if (minutes < 30) {
    return { 
      color: "text-green-600 dark:text-green-400", 
      bgColor: "bg-green-500/10",
      urgency: "normal",
      emoji: ""
    };
  }
  // 30-60 min: Amarelo - Atenção
  if (minutes < 60) {
    return { 
      color: "text-yellow-600 dark:text-yellow-400 font-medium", 
      bgColor: "bg-yellow-500/10",
      urgency: "attention",
      emoji: "🟡"
    };
  }
  // 1-2h: Laranja - Alerta
  if (hours < 2) {
    return { 
      color: "text-orange-500 font-medium", 
      bgColor: "bg-orange-500/10",
      urgency: "alert",
      emoji: "🟠"
    };
  }
  // 2-4h: Laranja escuro - Urgente
  if (hours < 4) {
    return { 
      color: "text-orange-600 dark:text-orange-400 font-semibold", 
      bgColor: "bg-orange-500/15",
      urgency: "urgent",
      emoji: "🔶"
    };
  }
  // 4h+: Vermelho - Crítico (pulsante)
  return { 
    color: "text-red-500 font-bold animate-pulse", 
    bgColor: "bg-red-500/15",
    urgency: "critical",
    emoji: "🔴"
  };
}

// Formatar tempo de espera de forma concisa
function formatWaitTime(date: Date): string {
  const minutes = differenceInMinutes(new Date(), date);
  const hours = differenceInHours(new Date(), date);
  
  if (minutes < 60) {
    return `${minutes}min`;
  }
  if (hours < 24) {
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}h${remainingMins}m` : `${hours}h`;
  }
  return formatDistanceToNow(date, { locale: ptBR, addSuffix: false });
}

function ConversationListItemComponent({ 
  conversation, 
  isActive, 
  onClick,
  index,
  unreadCount = 0,
  style
}: ConversationListItemProps) {
  // ✅ Query simples SEM realtime subscription - evita 50+ canais desnecessários
  const { data: messages } = useQuery({
    queryKey: ["messages-sentiment", conversation.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, content, sender_type, sender_id, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 min - não precisa atualizar sempre
    enabled: !!conversation.id,
  });
  
  const sentimentAnalysis = useSentimentAnalysis();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const hasAnalyzedRef = useRef(false);

  // Análise de sentimento
  useEffect(() => {
    if (messages && messages.length > 0 && !sentiment && !hasAnalyzedRef.current) {
      hasAnalyzedRef.current = true;
      
      const customerMessages = messages
        .filter(m => m.sender_type === 'contact')
        .slice(-5);

      if (customerMessages.length > 0) {
        const delay = index * 1500;
        
        setTimeout(() => {
          const formattedMessages = customerMessages.map(m => ({
            content: m.content,
            sender_type: m.sender_type as 'user' | 'contact'
          }));

          sentimentAnalysis.mutate(formattedMessages, {
            onSuccess: (result) => setSentiment(result),
            onError: () => setSentiment('neutro'),
          });
        }, delay);
      }
    }
  }, [messages, sentiment, index]);

  // SLA visual
  const lastMessageDate = new Date(conversation.last_message_at);
  const sla = getSLAColor(lastMessageDate);
  const waitTime = formatWaitTime(lastMessageDate);

  // Última mensagem preview (query retorna em ordem DESC, então [0] é a última)
  const lastMessage = messages?.[0];
  const lastMessagePreview = lastMessage?.content?.slice(0, 50) || "";

  return (
    <button
      onClick={onClick}
      style={style}
      className={cn(
        "w-full p-3 flex items-start gap-3 hover:bg-accent transition-colors text-left relative group border-b border-border",
        isActive && "bg-accent dark:bg-white/[0.05] border-l-2 border-l-primary"
      )}
    >
      {/* Avatar com ícone de canal */}
      <div className="relative shrink-0">
        <Avatar className={cn(
          "h-11 w-11 flex items-center justify-center",
          isActive ? "bg-primary/20 dark:bg-primary/10" : "bg-primary/10"
        )}>
          <span className="text-sm font-semibold text-primary">
            {conversation.contacts?.first_name?.[0] || ''}
            {conversation.contacts?.last_name?.[0] || ''}
          </span>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5">
          <ChannelIcon channel={conversation.channel} size="sm" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Linha 1: Nome + Tempo SLA */}
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-medium truncate text-foreground text-sm">
            {conversation.contacts?.first_name || 'Cliente'}{" "}
            {conversation.contacts?.last_name || ''}
          </p>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-xs whitespace-nowrap px-1.5 py-0.5 rounded", 
              sla.color,
              sla.urgency !== "normal" && sla.bgColor
            )}>
              {sla.emoji && `${sla.emoji} `}
              {waitTime}
            </span>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Linha 2: Preview da última mensagem */}
        {lastMessagePreview && (
          <p className="text-xs text-muted-foreground truncate mb-1.5">
            {lastMessage?.sender_type === 'contact' ? '' : '→ '}
            {lastMessagePreview}
            {lastMessage?.content?.length > 50 ? '...' : ''}
          </p>
        )}

        {/* Linha 3: Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
        {/* Tag de Cliente Verificado */}
          {(conversation.contacts?.kiwify_validated || conversation.contacts?.status === 'customer') ? (
            <Badge 
              variant="outline" 
              className="bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600 text-[10px] px-1.5 py-0 h-5 gap-0.5"
            >
              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
              Cliente
            </Badge>
          ) : (
            <Badge 
              variant="outline" 
              className="bg-muted/50 text-muted-foreground border-muted text-[10px] px-1.5 py-0 h-5"
            >
              Não Cliente
            </Badge>
          )}

          {conversation.department_data && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 h-5 border"
              style={{
                borderColor: conversation.department_data.color || undefined,
                color: conversation.department_data.color || undefined,
                backgroundColor: conversation.department_data.color 
                  ? `${conversation.department_data.color}15` 
                  : undefined,
              }}
            >
              {conversation.department_data.name}
            </Badge>
          )}
          
          {conversation.ai_mode && (
            <Badge 
              variant={
                conversation.ai_mode === 'autopilot' ? "default" : 
                conversation.ai_mode === 'copilot' ? "info" : 
                "secondary"
              }
              className="text-[10px] px-1.5 py-0 h-5"
            >
              {conversation.ai_mode === 'autopilot' && "🤖"}
              {conversation.ai_mode === 'copilot' && "🧠"}
              {conversation.ai_mode === 'disabled' && "👤"}
            </Badge>
          )}

          {sentiment && <SentimentBadge sentiment={sentiment} className="text-[10px] px-1.5 py-0 h-5" />}
          
          {conversation.assigned_user && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 max-w-[80px] truncate">
              {conversation.assigned_user.full_name.split(' ')[0]}
            </Badge>
          )}
          
          {conversation.channel === 'whatsapp' && !conversation.contacts?.email && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-5">
              ⚠️
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// Memoized export for performance
export const ConversationListItem = memo(ConversationListItemComponent, (prev, next) => {
  return (
    prev.conversation.id === next.conversation.id &&
    prev.conversation.last_message_at === next.conversation.last_message_at &&
    prev.conversation.status === next.conversation.status &&
    prev.conversation.ai_mode === next.conversation.ai_mode &&
    prev.conversation.assigned_to === next.conversation.assigned_to &&
    prev.isActive === next.isActive &&
    prev.unreadCount === next.unreadCount
  );
});
