import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversionTimelineData {
  date: string;
  total_deals: number;
  won_deals: number;
  lost_deals: number;
  conversion_rate: number;
}

export function useConversionStats(startDate?: Date, endDate?: Date) {
  // Fallback to 90 days if no range provided
  const effectiveStart = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const effectiveEnd = endDate || new Date();
  const daysBack = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));

  return useQuery({
    queryKey: ["conversion-stats-timeline", effectiveStart.toISOString(), effectiveEnd.toISOString()],
    queryFn: async () => {
      console.log(`📊 useConversionStats: Fetching conversion timeline`, { effectiveStart, effectiveEnd, daysBack });
      
      const { data, error } = await supabase.rpc("get_conversion_rate_timeline", {
        p_days_back: daysBack,
      });

      if (error) {
        console.error("❌ useConversionStats: Error fetching conversion timeline:", error);
        throw error;
      }

      // Filter to only include data within the date range
      const filtered = (data || []).filter((item: ConversionTimelineData) => {
        const itemDate = new Date(item.date);
        return itemDate >= effectiveStart && itemDate <= effectiveEnd;
      });

      console.log(`✅ useConversionStats: Fetched ${filtered.length} data points`);
      
      return filtered as ConversionTimelineData[];
    },
    staleTime: 1000 * 60 * 5,
  });
}
