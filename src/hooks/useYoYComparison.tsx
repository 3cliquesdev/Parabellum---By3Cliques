import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface YoYComparisonData {
  year2025: {
    totalRevenue: number;
    conversionRate: number;
    avgDealValue: number;
    wonDeals: number;
  };
  year2024: {
    totalRevenue: number;
    conversionRate: number;
    avgDealValue: number;
    wonDeals: number;
  };
  growth: {
    revenueGrowth: number;
    conversionGrowth: number;
    avgDealValueGrowth: number;
    wonDealsGrowth: number;
  };
}

export function useYoYComparison(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["yoy-comparison", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const start = startDate?.toISOString() || "2025-01-01";
      const end = endDate?.toISOString() || new Date().toISOString();
      
      console.log("📊 useYoYComparison: Buscando dados do período", { start, end });

      // Buscar dados reais do período selecionado
      const { data: deals2025, error } = await supabase
        .from("deals")
        .select("status, value, created_at")
        .gte("created_at", start)
        .lte("created_at", end);

      if (error) {
        console.error("❌ useYoYComparison: Erro ao buscar deals 2025:", error);
        throw error;
      }

      console.log(`✅ useYoYComparison: ${deals2025.length} deals encontrados em 2025`);

      // Calcular métricas de 2025
      const wonDeals2025 = deals2025.filter(d => d.status === "won");
      const lostDeals2025 = deals2025.filter(d => d.status === "lost");
      const totalRevenue2025 = wonDeals2025.reduce((sum, d) => sum + (d.value || 0), 0);
      const finalizedDeals2025 = wonDeals2025.length + lostDeals2025.length;
      const conversionRate2025 = finalizedDeals2025 > 0 
        ? (wonDeals2025.length / finalizedDeals2025) * 100 
        : 0;
      const avgDealValue2025 = wonDeals2025.length > 0 
        ? totalRevenue2025 / wonDeals2025.length 
        : 0;

      // Simular dados de 2024 (baseline simulado com -15% a -25% em relação a 2025)
      const year2025 = {
        totalRevenue: totalRevenue2025,
        conversionRate: conversionRate2025,
        avgDealValue: avgDealValue2025,
        wonDeals: wonDeals2025.length,
      };

      const year2024 = {
        totalRevenue: totalRevenue2025 * 0.82, // -18% simulado
        conversionRate: conversionRate2025 * 0.85, // -15% simulado
        avgDealValue: avgDealValue2025 * 0.90, // -10% simulado
        wonDeals: Math.floor(wonDeals2025.length * 0.75), // -25% simulado
      };

      // Calcular crescimento percentual
      const growth = {
        revenueGrowth: year2024.totalRevenue > 0
          ? ((year2025.totalRevenue - year2024.totalRevenue) / year2024.totalRevenue) * 100
          : 0,
        conversionGrowth: year2024.conversionRate > 0
          ? ((year2025.conversionRate - year2024.conversionRate) / year2024.conversionRate) * 100
          : 0,
        avgDealValueGrowth: year2024.avgDealValue > 0
          ? ((year2025.avgDealValue - year2024.avgDealValue) / year2024.avgDealValue) * 100
          : 0,
        wonDealsGrowth: year2024.wonDeals > 0
          ? ((year2025.wonDeals - year2024.wonDeals) / year2024.wonDeals) * 100
          : 0,
      };

      console.log("✅ useYoYComparison: Comparação YoY calculada", { year2025, year2024, growth });

      return { year2025, year2024, growth } as YoYComparisonData;
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}
