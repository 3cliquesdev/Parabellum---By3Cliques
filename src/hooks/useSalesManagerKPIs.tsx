import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SalesManagerKPIs {
  pipelineTotal: number;
  dealsWonThisMonth: number;
  revenueWonThisMonth: number;
  conversionRate: number;
  hotDealsCount: number;
  rottenDealsCount: number;
  funnelDistribution: {
    stageName: string;
    count: number;
    value: number;
  }[];
}

export function useSalesManagerKPIs() {
  return useQuery({
    queryKey: ["sales-manager-kpis"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Fetch all open deals for pipeline
      const { data: openDeals, error: openError } = await supabase
        .from("deals")
        .select("value, stage_id, stages(name, position), expected_close_date, updated_at")
        .eq("status", "open");

      if (openError) throw openError;

      const pipelineTotal = openDeals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;

      // Fetch deals won this month
      const { data: wonDeals, error: wonError } = await supabase
        .from("deals")
        .select("value")
        .eq("status", "won")
        .gte("closed_at", startOfMonth.toISOString());

      if (wonError) throw wonError;

      const dealsWonThisMonth = wonDeals?.length || 0;
      const revenueWonThisMonth = wonDeals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;

      // Fetch lost deals for conversion rate
      const { data: lostDeals, error: lostError } = await supabase
        .from("deals")
        .select("id")
        .eq("status", "lost")
        .gte("closed_at", startOfMonth.toISOString());

      if (lostError) throw lostError;

      const lostCount = lostDeals?.length || 0;
      const totalClosed = dealsWonThisMonth + lostCount;
      const conversionRate = totalClosed > 0 ? (dealsWonThisMonth / totalClosed) * 100 : 0;

      // Count hot deals (closing in 7 days)
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const hotDealsCount = openDeals?.filter((deal) => {
        if (!deal.expected_close_date) return false;
        const closeDate = new Date(deal.expected_close_date);
        return closeDate <= sevenDaysFromNow && closeDate >= new Date();
      }).length || 0;

      // Count rotten deals (no update in 14 days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const rottenDealsCount = openDeals?.filter((deal) => {
        const lastUpdate = new Date(deal.updated_at);
        return lastUpdate < fourteenDaysAgo;
      }).length || 0;

      // Calculate funnel distribution
      const funnelMap = new Map<string, { stageName: string; count: number; value: number; position: number }>();

      openDeals?.forEach((deal) => {
        const stage = deal.stages as any;
        const stageId = deal.stage_id || "no-stage";
        const stageName = stage?.name || "Sem etapa";
        const position = stage?.position || 999;

        if (!funnelMap.has(stageId)) {
          funnelMap.set(stageId, {
            stageName,
            count: 0,
            value: 0,
            position,
          });
        }

        const stageData = funnelMap.get(stageId)!;
        stageData.count += 1;
        stageData.value += deal.value || 0;
      });

      const funnelDistribution = Array.from(funnelMap.values())
        .sort((a, b) => a.position - b.position)
        .map(({ stageName, count, value }) => ({ stageName, count, value }));

      return {
        pipelineTotal,
        dealsWonThisMonth,
        revenueWonThisMonth,
        conversionRate,
        hotDealsCount,
        rottenDealsCount,
        funnelDistribution,
      } as SalesManagerKPIs;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
