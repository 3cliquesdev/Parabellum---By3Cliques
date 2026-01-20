import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatLocalDate } from "@/lib/dateUtils";

export interface WhoSoldCategory {
  category: string;
  label: string;
  color: string;
  sales: number;
  revenue: number;
  percentage: number;
  avgTicket: number;
}

// Categories based on source_type and lead_source
const CATEGORY_CONFIG: Record<string, { label: string; color: string; priority: number }> = {
  organico: { label: "Orgânico", color: "#8B5CF6", priority: 1 },
  afiliado: { label: "Afiliados/Parceiros", color: "#F59E0B", priority: 2 },
  comercial: { label: "Comercial (3 Cliques)", color: "#3B82F6", priority: 3 },
  formulario: { label: "Formulários", color: "#10B981", priority: 4 },
  indicacao: { label: "Indicação", color: "#EC4899", priority: 5 },
  recorrencia: { label: "Recorrência", color: "#06B6D4", priority: 6 },
  outros: { label: "Outros", color: "#6B7280", priority: 99 },
};

// Map lead_source to our categories
function mapSourceToCategory(leadSource: string | null, isAffiliate: boolean): string {
  if (isAffiliate) return "afiliado";
  
  const source = (leadSource || "").toLowerCase();
  
  if (source.includes("formulario") || source.includes("form") || source.includes("webchat") || source.includes("chat_widget")) {
    return "formulario";
  }
  if (source.includes("whatsapp") || source.includes("manual") || source.includes("comercial")) {
    return "comercial";
  }
  if (source.includes("indicacao") || source.includes("referral")) {
    return "indicacao";
  }
  if (source.includes("kiwify_recorrencia") || source.includes("recorrencia")) {
    return "recorrencia";
  }
  if (source.includes("kiwify") || source.includes("organic") || source.includes("direto")) {
    return "organico";
  }
  
  return "outros";
}

export function useWhoSoldMetrics(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["who-sold-metrics", formatLocalDate(startDate), formatLocalDate(endDate)],
    queryFn: async (): Promise<WhoSoldCategory[]> => {
      const startStr = `${formatLocalDate(startDate)}T00:00:00`;
      const endStr = `${formatLocalDate(endDate)}T23:59:59`;

      // Fetch won deals with their values and sources
      const { data: deals, error } = await supabase
        .from("deals")
        .select("id, value, lead_source, affiliate_name, affiliate_commission, is_organic_sale, gross_value")
        .eq("status", "won")
        .gte("closed_at", startStr)
        .lte("closed_at", endStr);

      if (error) throw error;

      // Group by category
      const categoryMap = new Map<string, { sales: number; revenue: number }>();
      let totalRevenue = 0;

      (deals || []).forEach((deal) => {
        // Determine if this is an affiliate sale
        const isAffiliate = !!deal.affiliate_name || (deal.affiliate_commission && deal.affiliate_commission > 0);
        const category = mapSourceToCategory(deal.lead_source, isAffiliate);
        
        const revenue = deal.gross_value || deal.value || 0;
        totalRevenue += revenue;

        if (!categoryMap.has(category)) {
          categoryMap.set(category, { sales: 0, revenue: 0 });
        }
        
        const stats = categoryMap.get(category)!;
        stats.sales++;
        stats.revenue += revenue;
      });

      // Convert to array with labels and percentages
      const result: WhoSoldCategory[] = Array.from(categoryMap.entries())
        .map(([category, stats]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.outros;
          return {
            category,
            label: config.label,
            color: config.color,
            sales: stats.sales,
            revenue: stats.revenue,
            percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
            avgTicket: stats.sales > 0 ? stats.revenue / stats.sales : 0,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      return result;
    },
    staleTime: 30 * 1000,
  });
}
