import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportMetrics {
  avgFRT: number;
  avgMTTR: number;
  avgCSAT: number;
  totalRatings: number;
}

export function useSupportMetrics(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["support-metrics", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_support_metrics_consolidated",
        {
          p_start: startDate.toISOString(),
          p_end: endDate.toISOString()
        }
      );

      if (error) {
        console.error("❌ Error fetching consolidated metrics:", error);
        throw error;
      }

      const result = data as any;
      return {
        avgFRT: result?.avgFRT || 0,
        avgMTTR: result?.avgMTTR || 0,
        avgCSAT: result?.avgCSAT || 0,
        totalRatings: result?.totalRatings || 0,
      } as SupportMetrics;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
