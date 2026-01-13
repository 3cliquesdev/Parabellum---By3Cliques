import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAverageResponseTime(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["average-response-time", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Calculate average response time from conversations
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("created_at, first_response_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .not("first_response_at", "is", null);

      if (error) throw error;

      if (!conversations || conversations.length === 0) {
        return 0;
      }

      // Calculate average response time in minutes
      const totalResponseTime = conversations.reduce((sum, conv) => {
        const created = new Date(conv.created_at).getTime();
        const firstResponse = new Date(conv.first_response_at!).getTime();
        const responseTimeMinutes = (firstResponse - created) / (1000 * 60);
        return sum + responseTimeMinutes;
      }, 0);

      return totalResponseTime / conversations.length;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
