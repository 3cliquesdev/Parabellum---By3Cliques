import { memo, useEffect, useState, useRef, useCallback, CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChannelIcon } from "@/components/ChannelIcon";
import { SentimentBadge } from "@/components/SentimentBadge";
import { WifiOff, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/displayName";
import { formatDistanceToNow, differenceInMinutes, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { useSentimentAnalysis, type Sentiment } from "@/hooks/useSentimentAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { prefetchMessages } from "@/hooks/useMessages";

// 🔧 TOKEN OPT: Cache global de sentimento por conversationId
// Persiste enquanto a aba estiver aberta — evita rechamar a IA no remount/scroll
const sentimentCache = new Map<string, Sentiment>();

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
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
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
  
  if (minutes < 15) return { color: "text-emerald-500", bgColor: "bg-emerald-500/10", urgency: "normal", emoji: "" };
  if (minutes < 30) return { color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/10", urgency: "normal", emoji: "" };
  if (minutes < 60) return { color: "text-yellow-600 dark:text-yellow-400 font-medium", bgColor: "bg-yellow-500/10", urgency: "attention", emoji: "" };
  if (hours < 2) return { color: "text-orange-500 font-medium", bgColor: "bg-orange-500/10", urgency: "alert", emoji: "" };
  if (hours < 4) return { color: "text-orange-600 dark:text-orange-400 font-semibold", bgColor: "bg-orange-500/15", urgency: "urgent", emoji: "" };
  return { color: "text-red-500 font-bold animate-pulse", bgColor: "bg-red-500/15", urgency: "critical", emoji: "" };
}

function formatWaitTime(date: Date): string {
  const minutes = differenceInMinutes(new Date(), date);
  const hours = differenceInHours(new Date(), date);
  if (minutes < 60) return `${minutes}min`;
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
  style,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: ConversationListItemProps) {
  const { data: whatsappInstances } = useWhatsAppInstances();
  
  const instanceStatus = conversation.whatsapp_instance_id && whatsappInstances
    ? whatsappInstances.find(i => i.id === conversation.whatsapp_instance_id)?.status
    : null;
  const isInstanceOffline = instanceStatus === 'disconnected' || instanceStatus === 'error';

  // 🔧 TOKEN OPT: Inicializa do cache global se já foi analisado antes
  const [sentiment, setSentiment] = useState<Sentiment | null>(
    () => sentimentCache.get(conversation.id) ?? null
  );

  // 🔧 TOKEN OPT: Só busca mensagens se ainda não tiver sentimento cacheado
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
    staleTime: 5 * 60 * 1000, // 5 min — aumentado de 2min
    enabled: !!conversation.id && !sentimentCache.has(conversation.id), // 🔧 Não busca se já tem cache
  });

  const sentimentAnalysis = useSentimentAnalysis();

  // Análise de sentimento — só roda se não tem cache
  useEffect(() => {
    if (sentimentCache.has(conversation.id)) return; // 🔧 Já analisado, sai imediatamente
    if (!messages || messages.length === 0 || sentiment) return;

    const customerMessages = messages
      .filter(m => m.sender_type === 'contact')
      .slice(-5);

    if (customerMessages.length === 0) return;

    // 🔧 TOKEN OPT: delay escalonado para não mandar 100 requests simultâneos
    const delay = Math.min(index * 1500, 30000); // cap em 30s

    const timer = setTimeout(() => {
      const formattedMessages = customerMessages.map(m => ({
        content: m.content,
        sender_type: m.sender_type as 'user' | 'contact'
      }));

      sentimentAnalysis.mutate({ messages: formattedMessages, conversationId: conversation.id }, {
        onSuccess: (result) => {
          sentimentCache.set(conversation.id, result); // 🔧 Salva no cache global
          setSentiment(result);
        },
        onError: () => {
          sentimentCache.set(conversation.id, 'neutro'); // 🔧 Cacheia erro também
          setSentiment('neutro');
        },
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [messages, conversation.id]); // 🔧 Removido `sentiment` e `index` das deps para evitar re-runs

  const lastMessageDate = new Date(conversation.last_message_at);
  const sla = getSLAColor(lastMessageDate);
  const waitTime = formatWaitTime(lastMessageDate);

  const lastMessage = messages?.[0];
  const lastMessagePreview = lastMessage?.content?.slice(0, 50) || "";

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(conversation.id);
    } else {
      onClick();
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = useCallback(() => {
    if (prefetchedRef.current) return;
    hoverTimerRef.current = setTimeout(() => {
      prefetchedRef.current = true;
      prefetchMessages(queryClient, conversation.id);
    }, 150);
  }, [conversation.id, queryClient]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
  }, []);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={cn(
        "w-full p-3 flex items-start gap-3 hover:bg-accent transition-colors text-left relative group border-b border-border",
        isActive && "bg-accent dark:bg-white/[0.05] border-l-2 border-l-primary",
        isSelected && "bg-primary/10"
      )}
    >
      {selectionMode && (
        <div className="shrink-0 flex items-center pt-1" onClick={handleCheckboxClick}>
          <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect?.(conversation.id)} />
        </div>
      )}

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
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-medium truncate text-foreground text-sm">
            {displayName(conversation.contacts?.first_name, conversation.contacts?.last_name, conversation.contacts?.email, conversation.contacts?.phone)}
          </p>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-xs whitespace-nowrap px-1.5 py-0.5 rounded",
              sla.color,
              sla.urgency !== "normal" && sla.bgColor
            )}>
              {waitTime}
            </span>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground truncate mb-1.5">
          <span className="font-mono text-[10px] text-muted-foreground/70 mr-1">
            #{conversation.id.slice(0, 8).toUpperCase()}
          </span>
          {lastMessagePreview && (
            <>
              {lastMessage?.sender_type === 'contact' ? '' : '↩ '}
              {lastMessagePreview}
              {lastMessage?.content?.length > 50 ? '...' : ''}
            </>
          )}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(conversation.contacts?.kiwify_validated || conversation.contacts?.status === 'customer') ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Cliente</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">Não Cliente</Badge>
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
              {conversation.ai_mode === 'autopilot' && "Autopilot"}
              {conversation.ai_mode === 'copilot' && "Copilot"}
              {conversation.ai_mode === 'disabled' && "Manual"}
            </Badge>
          )}

          {sentiment && <SentimentBadge sentiment={sentiment} className="text-[10px] px-1.5 py-0 h-5" />}

          {conversation.assigned_user ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 max-w-[80px] truncate">
              {conversation.assigned_user.full_name.split(' ')[0]}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-dashed">
              Pool
            </Badge>
          )}

          {conversation.channel === 'whatsapp' && !conversation.contacts?.email && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-5">
              <AlertTriangle className="h-3 w-3" />
            </Badge>
          )}

          {conversation.channel === 'whatsapp' && isInstanceOffline && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 border-yellow-500 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 gap-0.5"
              title="Instância WhatsApp desconectada - mensagens podem não ser entregues"
            >
              <WifiOff className="h-2.5 w-2.5" />
              Offline
            </Badge>
          )}

          {conversation.status === 'closed' && (conversation as any).closed_reason === 'whatsapp_window_expired' && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10 gap-0.5"
              title="Janela de 24h do WhatsApp expirada - use Template para reengajar"
            >
              <Clock className="h-2.5 w-2.5" />
              Janela expirada
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

export const ConversationListItem = memo(ConversationListItemComponent, (prev, next) => {
  return (
    prev.conversation.id === next.conversation.id &&
    prev.conversation.last_message_at === next.conversation.last_message_at &&
    prev.conversation.status === next.conversation.status &&
    prev.conversation.ai_mode === next.conversation.ai_mode &&
    prev.conversation.assigned_to === next.conversation.assigned_to &&
    (prev.conversation as any).closed_reason === (next.conversation as any).closed_reason &&
    prev.isActive === next.isActive &&
    prev.unreadCount === next.unreadCount &&
    prev.selectionMode === next.selectionMode &&
    prev.isSelected === next.isSelected
  );
});
