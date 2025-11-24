import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

interface SalesCycleStats {
  repId: string;
  repName: string;
  avgDaysToClose: number;
  totalDealsWon: number;
  fastestDeal: number;
  slowestDeal: number;
}

export function useSalesCycle() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["sales-cycle", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("created_at, closed_at, assigned_to, profiles!deals_assigned_to_fkey(full_name)")
        .eq("status", "won")
        .not("closed_at", "is", null);

      // Sales rep vê apenas seus deals
      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      // Agrupar por vendedor
      const repMap = new Map<string, {
        repName: string;
        dealTimes: number[];
      }>();

      deals?.forEach((deal: any) => {
        const repId = deal.assigned_to || "unassigned";
        const repName = deal.profiles?.full_name || "Não atribuído";
        
        const createdDate = new Date(deal.created_at);
        const closedDate = new Date(deal.closed_at);
        const daysToClose = Math.floor((closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        if (!repMap.has(repId)) {
          repMap.set(repId, {
            repName,
            dealTimes: [],
          });
        }

        repMap.get(repId)!.dealTimes.push(daysToClose);
      });

      // Calcular estatísticas por vendedor
      const stats: SalesCycleStats[] = Array.from(repMap.entries()).map(([repId, data]) => {
        const dealTimes = data.dealTimes;
        const avgDays = dealTimes.reduce((sum, days) => sum + days, 0) / dealTimes.length;
        
        return {
          repId,
          repName: data.repName,
          avgDaysToClose: avgDays,
          totalDealsWon: dealTimes.length,
          fastestDeal: Math.min(...dealTimes),
          slowestDeal: Math.max(...dealTimes),
        };
      });

      // Ordenar por velocidade (menor tempo = melhor)
      return stats.sort((a, b) => a.avgDaysToClose - b.avgDaysToClose);
    },
  });
}
