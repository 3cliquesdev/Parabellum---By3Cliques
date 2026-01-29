import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TimelineEvent {
  id: string;
  type: 'interaction' | 'ticket' | 'deal' | 'conversation' | 'onboarding' | 'message';
  date: string;
  title: string;
  description: string;
  icon: string;
  metadata?: any;
}

export function useUnifiedTimeline(contactId: string | null) {
  return useQuery({
    queryKey: ["unified-timeline", contactId],
    queryFn: async () => {
      if (!contactId) return [];

      // Buscar interações
      const { data: interactions } = await supabase
        .from("interactions")
        .select("*")
        .eq("customer_id", contactId)
        .order("created_at", { ascending: false });

      // Buscar tickets
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, subject, status, priority, created_at, customer_id")
        .eq("customer_id", contactId)
        .order("created_at", { ascending: false });

      // Buscar deals ganhos
      const { data: deals } = await supabase
        .from("deals")
        .select("id, title, value, currency, status, closed_at, created_at, contact_id")
        .eq("contact_id", contactId)
        .eq("status", "won")
        .order("closed_at", { ascending: false });

      // Buscar conversas anteriores COM resumo de mensagens
      const { data: conversations } = await supabase
        .from("conversations")
        .select(`
          id, 
          channel, 
          status, 
          ai_mode, 
          created_at, 
          closed_at,
          contact_id,
          assigned_to,
          profiles:assigned_to(full_name)
        `)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      // Buscar TODAS as mensagens do contato (via conversation_id)
      // Agrupamos por conversa para mostrar histórico completo
      const conversationIds = (conversations || []).map(c => c.id);
      
      let allMessages: any[] = [];
      if (conversationIds.length > 0) {
        const { data: messages } = await supabase
          .from("messages")
          .select(`
            id,
            content,
            sender_type,
            is_ai_generated,
            is_internal,
            created_at,
            conversation_id,
            sender:profiles!sender_id(full_name)
          `)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(5000); // Carregar histórico completo (até 5k mensagens)
        
        allMessages = messages || [];
      }

      // Buscar etapas de onboarding concluídas
      const { data: journeySteps } = await supabase
        .from("customer_journey_steps")
        .select("*")
        .eq("contact_id", contactId)
        .eq("completed", true)
        .order("completed_at", { ascending: false });

      // Mapear para formato unificado
      const timeline: TimelineEvent[] = [];

      // Interações
      (interactions || []).forEach((interaction) => {
        timeline.push({
          id: interaction.id,
          type: 'interaction',
          date: interaction.created_at,
          title: interaction.type.replace(/_/g, ' '),
          description: interaction.content,
          icon: '📝',
          metadata: interaction.metadata,
        });
      });

      // Tickets
      (tickets || []).forEach((ticket) => {
        timeline.push({
          id: ticket.id,
          type: 'ticket',
          date: ticket.created_at,
          title: `Ticket: ${ticket.subject}`,
          description: `Status: ${ticket.status} | Prioridade: ${ticket.priority}`,
          icon: 'ticket',
          metadata: ticket,
        });
      });

      // Deals
      (deals || []).forEach((deal) => {
        timeline.push({
          id: deal.id,
          type: 'deal',
          date: deal.closed_at || deal.created_at,
          title: `Negócio Ganho: ${deal.title}`,
          description: `Valor: ${new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: deal.currency || "BRL",
          }).format(deal.value || 0)}`,
          icon: 'deal',
          metadata: deal,
        });
      });

      // Conversas COM contagem de mensagens
      (conversations || []).forEach((conversation) => {
        const convMessages = allMessages.filter(m => m.conversation_id === conversation.id);
        const messageCount = convMessages.length;
        const agentName = (conversation.profiles as any)?.full_name;
        
        timeline.push({
          id: conversation.id,
          type: 'conversation',
          date: conversation.created_at,
          title: `Conversa via ${conversation.channel}`,
          description: `${messageCount} mensagens | Status: ${conversation.status}${agentName ? ` | Atendente: ${agentName}` : ''}`,
          icon: 'conversation',
          metadata: { 
            ...conversation, 
            message_count: messageCount,
            messages_preview: convMessages.slice(0, 5) // Últimas 5 mensagens para preview
          },
        });
      });

      // Mensagens individuais (para busca detalhada)
      // Incluímos cada mensagem como evento separado para permitir busca granular
      allMessages.forEach((message) => {
        const senderLabel = message.sender_type === 'contact' 
          ? 'Cliente' 
          : message.is_ai_generated 
            ? 'IA' 
            : (message.sender?.full_name || 'Agente');
        
        timeline.push({
          id: `msg-${message.id}`,
          type: 'message',
          date: message.created_at,
          title: `${senderLabel}${message.is_internal ? ' (Nota interna)' : ''}`,
          description: message.content?.slice(0, 200) || '(sem conteúdo)',
          icon: message.is_internal ? 'note' : 'message',
          metadata: {
            message_id: message.id,
            conversation_id: message.conversation_id,
            sender_type: message.sender_type,
            is_ai_generated: message.is_ai_generated,
            is_internal: message.is_internal,
            full_content: message.content,
          },
        });
      });

      // Etapas de onboarding
      (journeySteps || []).forEach((step) => {
        timeline.push({
          id: step.id,
          type: 'onboarding',
          date: step.completed_at || step.created_at,
          title: `Onboarding: ${step.step_name}`,
          description: step.notes || 'Etapa concluída',
          icon: 'onboarding',
          metadata: step,
        });
      });

      // Ordenar por data (mais recente primeiro)
      return timeline.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    enabled: !!contactId,
    // Manter histórico em cache por mais tempo
    staleTime: 1000 * 60 * 10, // 10 minutos
    gcTime: 1000 * 60 * 60, // 1 hora
  });
}
