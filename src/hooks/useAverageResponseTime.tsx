import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAverageResponseTime(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["average-response-time", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Usar RPC otimizada em vez de calcular no client-side
      const { data, error } = await supabase.rpc("get_avg_first_response_time", {
        p_start: startDate.toISOString(),
        p_end: endDate.toISOString()
      });

      if (error) {
        console.error('[useAverageResponseTime] RPC error:', error);
        return 0;
      }

      return data || 0;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
