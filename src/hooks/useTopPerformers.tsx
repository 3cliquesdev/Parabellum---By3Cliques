import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay } from "date-fns";

export interface TopPerformer {
  id: string;
  name: string;
  avatarUrl: string | null;
  revenueWon: number;
  dealsWon: number;
}

export function useTopPerformers(dateRange: DateRange | undefined, limit: number = 5) {
  return useQuery({
    queryKey: ["top-performers", dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), limit],
    queryFn: async (): Promise<TopPerformer[]> => {
      if (!dateRange?.from || !dateRange?.to) {
        return [];
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();

      // Get won deals with assigned_to in period
      const { data: wonDeals } = await supabase
        .from("deals")
        .select("assigned_to, value, net_value")
        .eq("status", "won")
        .gte("closed_at", startDate)
        .lte("closed_at", endDate)
        .not("assigned_to", "is", null);

      if (!wonDeals || wonDeals.length === 0) {
        return [];
      }

      // Group by assigned_to
      const performerMap = new Map<string, { revenue: number; deals: number }>();
      
      wonDeals.forEach(deal => {
        if (deal.assigned_to) {
          const current = performerMap.get(deal.assigned_to) || { revenue: 0, deals: 0 };
          performerMap.set(deal.assigned_to, {
            revenue: current.revenue + (deal.net_value || deal.value || 0),
            deals: current.deals + 1
          });
        }
      });

      // Get profile info for these users
      const userIds = Array.from(performerMap.keys());
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      // Combine and sort
      const performers: TopPerformer[] = [];
      
      performerMap.forEach((stats, id) => {
        const profile = profiles?.find(p => p.id === id);
        performers.push({
          id,
          name: profile?.full_name || "Usuário",
          avatarUrl: profile?.avatar_url || null,
          revenueWon: stats.revenue,
          dealsWon: stats.deals
        });
      });

      // Sort by revenue and limit
      return performers
        .sort((a, b) => b.revenueWon - a.revenueWon)
        .slice(0, limit);
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 1000 * 60 * 2
  });
}
