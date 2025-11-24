import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversionTimelineData {
  date: string;
  total_deals: number;
  won_deals: number;
  lost_deals: number;
  conversion_rate: number;
}

export function useConversionStats(daysBack: number = 90) {
  return useQuery({
    queryKey: ["conversion-stats-timeline", daysBack],
    queryFn: async () => {
      console.log(`📊 useConversionStats: Fetching conversion timeline for last ${daysBack} days`);
      
      const { data, error } = await supabase.rpc("get_conversion_rate_timeline", {
        p_days_back: daysBack,
      });

      if (error) {
        console.error("❌ useConversionStats: Error fetching conversion timeline:", error);
        throw error;
      }

      console.log(`✅ useConversionStats: Fetched ${data?.length || 0} data points`, data);
      
      return (data || []) as ConversionTimelineData[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
