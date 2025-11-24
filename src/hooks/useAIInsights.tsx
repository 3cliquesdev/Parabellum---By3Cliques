import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AIInsightsData {
  insights: string;
  metrics: {
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    conversionRate: number;
    totalValue: number;
    avgDealValue: number;
    recentConversionTrend: number;
  };
  generatedAt: string;
}

export function useAIInsights(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["ai-insights", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      console.log("📊 useAIInsights: Chamando edge function generate-sales-insights", { startDate, endDate });

      const { data, error } = await supabase.functions.invoke("generate-sales-insights", {
        body: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString()
        }
      });

      if (error) {
        console.error("❌ useAIInsights: Erro ao gerar insights:", error);
        throw error;
      }

      console.log("✅ useAIInsights: Insights gerados com sucesso", data);

      return data as AIInsightsData;
    },
    staleTime: 1000 * 60 * 10, // 10 minutos - insights não mudam frequentemente
  });
}
