import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TimelineEvent {
  id: string;
  type: 'interaction' | 'ticket' | 'deal' | 'conversation' | 'onboarding';
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

      // Buscar conversas anteriores
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, channel, status, ai_mode, created_at, contact_id")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

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
          title: `🎫 Ticket: ${ticket.subject}`,
          description: `Status: ${ticket.status} | Prioridade: ${ticket.priority}`,
          icon: '🎫',
          metadata: ticket,
        });
      });

      // Deals
      (deals || []).forEach((deal) => {
        timeline.push({
          id: deal.id,
          type: 'deal',
          date: deal.closed_at || deal.created_at,
          title: `💰 Negócio Ganho: ${deal.title}`,
          description: `Valor: ${new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: deal.currency || "BRL",
          }).format(deal.value || 0)}`,
          icon: '💰',
          metadata: deal,
        });
      });

      // Conversas
      (conversations || []).forEach((conversation) => {
        timeline.push({
          id: conversation.id,
          type: 'conversation',
          date: conversation.created_at,
          title: `💬 Conversa via ${conversation.channel}`,
          description: `Status: ${conversation.status}${conversation.ai_mode ? ` | Modo: ${conversation.ai_mode}` : ''}`,
          icon: '💬',
          metadata: conversation,
        });
      });

      // Etapas de onboarding
      (journeySteps || []).forEach((step) => {
        timeline.push({
          id: step.id,
          type: 'onboarding',
          date: step.completed_at || step.created_at,
          title: `✅ Onboarding: ${step.step_name}`,
          description: step.notes || 'Etapa concluída',
          icon: '✅',
          metadata: step,
        });
      });

      // Ordenar por data (mais recente primeiro)
      return timeline.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    enabled: !!contactId,
  });
}
