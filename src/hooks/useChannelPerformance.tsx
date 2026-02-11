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
      const { data, error } = await supabase.rpc("get_channel_performance_consolidated", {
        p_start: startDate.toISOString(),
        p_end: endDate.toISOString(),
      });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        channel: row.channel === 'web_chat' ? 'Web Chat'
               : row.channel === 'whatsapp' ? 'WhatsApp'
               : row.channel === 'email' ? 'Email'
               : row.channel,
        total_conversations: Number(row.total_conversations),
        closed_conversations: Number(row.closed_conversations),
        conversion_rate: Number(row.conversion_rate),
        avg_csat: Number(row.avg_csat),
        total_messages: Number(row.total_messages),
        ai_handled: Number(row.ai_handled),
        human_handled: Number(row.human_handled),
      })).sort((a: ChannelPerformance, b: ChannelPerformance) => b.total_conversations - a.total_conversations);
    },
  });
}
