import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TopTopic {
  topic: string;
  count: number;
  percentage: number;
}

export function useTopTopics(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['top-topics', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<TopTopic[]> => {
      // Query AI usage logs for autopilot responses
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('id, result_data, created_at')
        .eq('feature_type', 'autopilot')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Count topics from tickets
      const { data: tickets } = await supabase
        .from('tickets')
        .select('category')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('category', 'is', null);

      const topicMap = new Map<string, number>();

      // Count ticket categories
      tickets?.forEach((ticket) => {
        const category = ticket.category || 'Outros';
        topicMap.set(category, (topicMap.get(category) || 0) + 1);
      });

      const total = Array.from(topicMap.values()).reduce((sum, count) => sum + count, 0);

      // Convert to array and sort
      const result: TopTopic[] = Array.from(topicMap.entries())
        .map(([topic, count]) => ({
          topic: topic.charAt(0).toUpperCase() + topic.slice(1),
          count,
          percentage: total > 0 ? (count / total) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5

      return result;
    },
  });
}
