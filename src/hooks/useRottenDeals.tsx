import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export function useRottenDeals() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["rotten-deals", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          *,
          contacts!deals_contact_id_fkey(first_name, last_name),
          organizations(name),
          assigned_user:profiles!deals_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq("status", "open");

      // Filtrar por assigned_to se for sales_rep
      if (role && (role as string) === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data: deals, error } = await query.order("updated_at", { ascending: true });

      if (error) throw error;

      // Buscar atividades para cada deal
      const dealsWithActivities = await Promise.all(
        (deals || []).map(async (deal) => {
          const { data: activities } = await supabase
            .from("activities")
            .select("due_date, completed")
            .eq("deal_id", deal.id)
            .eq("completed", false)
            .order("due_date", { ascending: true })
            .limit(1);

          const nextActivity = activities?.[0];

          const daysSinceUpdate = differenceInDays(new Date(), new Date(deal.updated_at));
          const daysSinceActivity = nextActivity
            ? differenceInDays(new Date(), new Date(nextActivity.due_date))
            : 999;

          const isRotten = daysSinceUpdate > 14 || daysSinceActivity > 7;

          return {
            ...deal,
            nextActivity,
            daysSinceUpdate,
            daysSinceActivity,
            isRotten,
          };
        })
      );

      // Filtrar apenas rotten deals e ordenar por mais críticos
      return dealsWithActivities
        .filter((deal) => deal.isRotten)
        .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
    },
  });
}
