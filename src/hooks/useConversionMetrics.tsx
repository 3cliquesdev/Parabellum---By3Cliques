import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useConversionMetrics() {
  return useQuery({
    queryKey: ["conversion-metrics"],
    queryFn: async () => {
      const { data: deals, error } = await supabase
        .from("deals")
        .select("status, stage_id, stages(name, position)");

      if (error) throw error;

      const totalDeals = deals.length;
      const wonDeals = deals.filter(d => d.status === 'won').length;
      const lostDeals = deals.filter(d => d.status === 'lost').length;
      const openDeals = deals.filter(d => d.status === 'open').length;

      const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
      const lossRate = totalDeals > 0 ? (lostDeals / totalDeals) * 100 : 0;

      return {
        totalDeals,
        wonDeals,
        lostDeals,
        openDeals,
        conversionRate,
        lossRate,
      };
    },
  });
}
