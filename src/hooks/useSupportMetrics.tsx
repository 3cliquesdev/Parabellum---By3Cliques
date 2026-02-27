import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportMetrics {
  avgFRT: number;
  avgMTTR: number;
  avgCSAT: number;
  totalRatings: number;
}

export interface SupportDashboardCounts {
  tickets_open: number;
  conversations_total: number;
  conversations_closed: number;
  sla_risk: number;
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
    staleTime: 5 * 60 * 1000,
  });
}

export function useSupportDashboardCounts(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["support-dashboard-counts", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_support_dashboard_counts",
        {
          p_start: startDate.toISOString(),
          p_end: endDate.toISOString()
        }
      );

      if (error) {
        console.error("❌ Error fetching dashboard counts:", error);
        throw error;
      }

      const result = data as any;
      return {
        tickets_open: result?.tickets_open || 0,
        conversations_total: result?.conversations_total || 0,
        conversations_closed: result?.conversations_closed || 0,
        sla_risk: result?.sla_risk || 0,
      } as SupportDashboardCounts;
    },
    staleTime: 2 * 60 * 1000,
  });
}
