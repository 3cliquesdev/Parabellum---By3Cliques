import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AIEconomyData {
  date: string;
  total_conversations: number;
  ai_resolved: number;
  economy_percentage: number;
}

export function useAIEconomy(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['ai-economy', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<AIEconomyData[]> => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, created_at, ai_mode, status')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by day
      const dailyMap = new Map<string, { total: number; ai_resolved: number }>();

      data?.forEach((conv) => {
        const date = new Date(conv.created_at).toISOString().split('T')[0];
        
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { total: 0, ai_resolved: 0 });
        }

        const stats = dailyMap.get(date)!;
        stats.total += 1;

        // Count as AI resolved if closed by autopilot without human intervention
        if (conv.status === 'closed' && conv.ai_mode === 'autopilot') {
          stats.ai_resolved += 1;
        }
      });

      // Convert to array
      const result: AIEconomyData[] = Array.from(dailyMap.entries())
        .map(([date, stats]) => ({
          date,
          total_conversations: stats.total,
          ai_resolved: stats.ai_resolved,
          economy_percentage: stats.total > 0 ? (stats.ai_resolved / stats.total) * 100 : 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return result;
    },
  });
}
