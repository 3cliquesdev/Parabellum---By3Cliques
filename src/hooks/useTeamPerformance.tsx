import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMemberPerformance {
  id: string;
  name: string;
  avatar_url: string | null;
  chatsAttended: number;
  avgResponseTime: number;
  avgCSAT: number;
  totalCSATRatings: number;
  salesClosed: number;
  totalRevenue: number;
}

export function useTeamPerformance(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["team-performance", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      console.log("📊 useTeamPerformance: Fetching via consolidated RPC", { startDate, endDate });

      const { data, error } = await supabase.rpc("get_team_performance_consolidated", {
        p_start: startDate.toISOString(),
        p_end: endDate.toISOString(),
      });

      if (error) throw error;

      const activeMembers = (data || [])
        .map((row: any) => ({
          id: row.agent_id,
          name: row.agent_name,
          avatar_url: row.avatar_url,
          chatsAttended: Number(row.chats_attended),
          avgResponseTime: Number(row.avg_response_minutes),
          avgCSAT: Number(row.avg_csat),
          totalCSATRatings: Number(row.total_csat_ratings),
          salesClosed: Number(row.sales_closed),
          totalRevenue: Number(row.total_revenue),
        }))
        .filter((m: TeamMemberPerformance) => m.chatsAttended > 0 || m.salesClosed > 0)
        .sort((a: TeamMemberPerformance, b: TeamMemberPerformance) => b.chatsAttended - a.chatsAttended);

      console.log("✅ Team performance fetched:", activeMembers.length, "active members (1 RPC)");
      return activeMembers;
    },
    staleTime: 1000 * 60 * 5,
  });
}
