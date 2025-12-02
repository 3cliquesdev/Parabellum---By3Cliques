import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon } from "@/components/ChannelIcon";
import { SentimentBadge } from "@/components/SentimentBadge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInMinutes, differenceInHours } from "date-fns";
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

interface ConversationListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  index: number;
  unreadCount?: number;
}

// FASE 4: Calcular cor do indicador de SLA
function getSLAColor(lastMessageAt: Date): { color: string; urgency: "normal" | "warning" | "critical" } {
  const hours = differenceInHours(new Date(), lastMessageAt);
  const minutes = differenceInMinutes(new Date(), lastMessageAt);
  
  if (hours >= 4) {
    return { color: "text-red-500 font-semibold", urgency: "critical" };
  }
  if (hours >= 1) {
    return { color: "text-orange-500 font-medium", urgency: "warning" };
  }
  return { color: "text-muted-foreground", urgency: "normal" };
}

// Formatar tempo de espera de forma concisa
function formatWaitTime(date: Date): string {
  const minutes = differenceInMinutes(new Date(), date);
  const hours = differenceInHours(new Date(), date);
  
  if (minutes < 60) {
    return `${minutes}min`;
  }
  if (hours < 24) {
    return `${hours}h`;
  }
  return formatDistanceToNow(date, { locale: ptBR, addSuffix: false });
}

export function ConversationListItem({ 
  conversation, 
  isActive, 
  onClick,
  index,
  unreadCount = 0
}: ConversationListItemProps) {
  const { data: messages } = useMessages(conversation.id);
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

  // Última mensagem preview
  const lastMessage = messages?.[messages.length - 1];
  const lastMessagePreview = lastMessage?.content?.slice(0, 50) || "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 flex items-start gap-3 hover:bg-accent transition-colors text-left relative group",
        isActive && "bg-accent dark:bg-white/[0.05] border-l-2 border-primary"
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
        {/* FASE 2: Ícone de canal colorido */}
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
            {/* FASE 4: Indicador de tempo com cor SLA */}
            <span className={cn("text-xs whitespace-nowrap", sla.color)}>
              {sla.urgency === "critical" && "🔴 "}
              {sla.urgency === "warning" && "🟠 "}
              {waitTime}
            </span>
            {/* FASE 4: Badge de não lidas */}
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
          {/* Departamento */}
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
          
          {/* AI Mode */}
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

          {/* Sentimento */}
          {sentiment && <SentimentBadge sentiment={sentiment} className="text-[10px] px-1.5 py-0 h-5" />}
          
          {/* Responsável */}
          {conversation.assigned_user && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 max-w-[80px] truncate">
              {conversation.assigned_user.full_name.split(' ')[0]}
            </Badge>
          )}
          
          {/* Alerta sem email */}
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
