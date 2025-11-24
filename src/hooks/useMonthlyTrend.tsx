import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MonthlyTrendData {
  month: string;
  monthNumber: number;
  year: number;
  totalGoalsValue: number;
  totalAchievedValue: number;
  achievementRate: number;
  goalsCount: number;
}

export function useMonthlyTrend(year: number, monthsBack: number = 6) {
  return useQuery({
    queryKey: ["monthly-trend", year, monthsBack],
    queryFn: async () => {
      console.log("📈 useMonthlyTrend: Fetching trend data", { year, monthsBack });

      const currentMonth = new Date().getMonth() + 1;
      const trendData: MonthlyTrendData[] = [];

      // Calculate for last N months
      for (let i = monthsBack - 1; i >= 0; i--) {
        let targetMonth = currentMonth - i;
        let targetYear = year;

        // Handle year rollover
        if (targetMonth <= 0) {
          targetMonth += 12;
          targetYear--;
        }

        const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString();
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59).toISOString();

        // Fetch goals for this month
        const { data: goals } = await supabase
          .from("sales_goals")
          .select("target_value")
          .eq("period_month", targetMonth)
          .eq("period_year", targetYear)
          .eq("status", "active");

        // Fetch deals won in this month
        const { data: deals } = await supabase
          .from("deals")
          .select("value")
          .eq("status", "won")
          .gte("closed_at", startDate)
          .lte("closed_at", endDate);

        const totalGoalsValue = goals?.reduce((sum, g) => sum + Number(g.target_value || 0), 0) || 0;
        const totalAchievedValue = deals?.reduce((sum, d) => sum + Number(d.value || 0), 0) || 0;
        const achievementRate = totalGoalsValue > 0 ? (totalAchievedValue / totalGoalsValue) * 100 : 0;

        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        trendData.push({
          month: monthNames[targetMonth - 1],
          monthNumber: targetMonth,
          year: targetYear,
          totalGoalsValue,
          totalAchievedValue,
          achievementRate: Math.round(achievementRate),
          goalsCount: goals?.length || 0,
        });
      }

      console.log("✅ Monthly trend data calculated:", trendData);
      return trendData;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
