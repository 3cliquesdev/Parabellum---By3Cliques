import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface LostReasonStat {
  reason: string;
  count: number;
  totalValue: number;
}

export function useLostReasonsStats() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["lost-reasons-stats", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("lost_reason, value, currency")
        .eq("status", "lost")
        .not("lost_reason", "is", null);

      // Filtrar por assigned_to se for sales_rep
      if (role && (role as string) === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por lost_reason
      const grouped = (data || []).reduce((acc, deal) => {
        const reason = deal.lost_reason || "Sem motivo";
        if (!acc[reason]) {
          acc[reason] = { count: 0, totalValue: 0 };
        }
        acc[reason].count++;
        acc[reason].totalValue += deal.value || 0;
        return acc;
      }, {} as Record<string, { count: number; totalValue: number }>);

      const stats: LostReasonStat[] = Object.entries(grouped)
        .map(([reason, stats]) => ({ reason, ...stats }))
        .sort((a, b) => b.count - a.count);

      return stats;
    },
  });
}
