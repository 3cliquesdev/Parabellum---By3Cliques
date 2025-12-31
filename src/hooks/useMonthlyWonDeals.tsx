import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MonthlyWonData {
  month: string;
  value: number;
  count: number;
}

export function useMonthlyWonDeals() {
  return useQuery({
    queryKey: ["monthly-won-deals"],
    queryFn: async () => {
      const now = new Date();
      const months: MonthlyWonData[] = [];

      // Get last 6 months data
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);

        const { data, error } = await supabase
          .from("deals")
          .select("value")
          .eq("status", "won")
          .gte("closed_at", start.toISOString())
          .lte("closed_at", end.toISOString());

        if (error) throw error;

        months.push({
          month: format(monthDate, "MMM", { locale: ptBR }),
          value: data?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0,
          count: data?.length || 0,
        });
      }

      return months;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
