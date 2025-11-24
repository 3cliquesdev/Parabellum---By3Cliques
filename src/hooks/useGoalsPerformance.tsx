import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SellerPerformance {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  goalId: string | null;
  goalTitle: string | null;
  targetValue: number;
  currentValue: number;
  percentage: number;
  dealCount: number;
  status: "exceeding" | "on_track" | "at_risk" | "no_goal";
}

export function useGoalsPerformance(month: number, year: number) {
  return useQuery({
    queryKey: ["goals-performance", month, year],
    queryFn: async () => {
      console.log("📊 useGoalsPerformance: Fetching performance data", { month, year });

      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      // Fetch all active goals for the period
      const { data: goals, error: goalsError } = await supabase
        .from("sales_goals")
        .select("*, assigned_user:profiles!sales_goals_assigned_to_fkey(id, full_name, avatar_url)")
        .eq("period_month", month)
        .eq("period_year", year)
        .eq("status", "active")
        .eq("goal_type", "individual"); // Only individual goals for seller comparison

      if (goalsError) {
        console.error("❌ Error fetching goals:", goalsError);
        throw goalsError;
      }

      // Fetch all deals won in the period
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("assigned_to, value")
        .eq("status", "won")
        .gte("closed_at", startDate)
        .lte("closed_at", endDate);

      if (dealsError) {
        console.error("❌ Error fetching deals:", dealsError);
        throw dealsError;
      }

      // Calculate performance for each seller with a goal
      const performanceMap = new Map<string, SellerPerformance>();

      goals?.forEach((goal) => {
        if (!goal.assigned_to || !goal.assigned_user) return;

        const sellerDeals = deals?.filter(d => d.assigned_to === goal.assigned_to) || [];
        const currentValue = sellerDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
        const percentage = goal.target_value > 0 ? (currentValue / goal.target_value) * 100 : 0;

        let status: "exceeding" | "on_track" | "at_risk" | "no_goal" = "at_risk";
        if (percentage >= 100) status = "exceeding";
        else if (percentage >= 70) status = "on_track";

        performanceMap.set(goal.assigned_to, {
          userId: goal.assigned_to,
          fullName: goal.assigned_user.full_name,
          avatarUrl: goal.assigned_user.avatar_url,
          goalId: goal.id,
          goalTitle: goal.title,
          targetValue: goal.target_value,
          currentValue,
          percentage: Math.round(percentage),
          dealCount: sellerDeals.length,
          status,
        });
      });

      // Sort by percentage (descending)
      const sortedPerformance = Array.from(performanceMap.values()).sort(
        (a, b) => b.percentage - a.percentage
      );

      console.log("✅ Performance data calculated:", sortedPerformance);
      return sortedPerformance;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
