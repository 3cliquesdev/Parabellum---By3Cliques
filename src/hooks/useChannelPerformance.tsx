import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChannelPerformance {
  channel: string;
  total_conversations: number;
  closed_conversations: number;
  conversion_rate: number;
  avg_csat: number;
  total_messages: number;
  ai_handled: number;
  human_handled: number;
}

export function useChannelPerformance(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["channel-performance", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const channels: Array<'web_chat' | 'whatsapp' | 'email'> = ['web_chat', 'whatsapp', 'email'];
      
      const performance: ChannelPerformance[] = await Promise.all(
        channels.map(async (channel) => {
          // Get conversation stats
          const { data: conversations, error: convError } = await supabase
            .from("conversations")
            .select("id, status, ai_mode")
            .eq("channel", channel)
            .gte("created_at", startDate.toISOString())
            .lte("created_at", endDate.toISOString());

          if (convError) throw convError;

          const totalConversations = conversations?.length || 0;
          const closedConversations = conversations?.filter(c => c.status === 'closed').length || 0;
          const aiHandled = conversations?.filter(c => c.ai_mode === 'autopilot').length || 0;
          const humanHandled = totalConversations - aiHandled;

          // Get CSAT scores
          const conversationIds = conversations?.map(c => c.id) || [];
          const { data: ratings } = conversationIds.length > 0
            ? await supabase
                .from("conversation_ratings")
                .select("rating")
                .in("conversation_id", conversationIds)
            : { data: null };

          const avgCsat = ratings && ratings.length > 0
            ? (ratings as Array<{ rating: number }>).reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : 0;

          // Get message count
          const { count: messageCount } = conversationIds.length > 0
            ? await supabase
                .from("messages")
                .select("id", { count: 'exact', head: true })
                .in("conversation_id", conversationIds)
            : { count: 0 };

          return {
            channel: channel === 'web_chat' ? 'Web Chat' : channel === 'whatsapp' ? 'WhatsApp' : 'Email',
            total_conversations: totalConversations,
            closed_conversations: closedConversations,
            conversion_rate: totalConversations > 0 ? (closedConversations / totalConversations) * 100 : 0,
            avg_csat: avgCsat,
            total_messages: messageCount || 0,
            ai_handled: aiHandled,
            human_handled: humanHandled,
          };
        })
      );

      return performance.sort((a, b) => b.total_conversations - a.total_conversations);
    },
  });
}
