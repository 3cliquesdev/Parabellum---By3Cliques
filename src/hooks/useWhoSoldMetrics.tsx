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

// Categories for "Who Sold" ranking
const CATEGORY_CONFIG: Record<string, { label: string; color: string; priority: number }> = {
  organico: { label: "Orgânico", color: "#8B5CF6", priority: 1 },
  afiliado: { label: "Afiliados/Parceiros", color: "#F59E0B", priority: 2 },
  recorrencia: { label: "Recorrência", color: "#06B6D4", priority: 3 },
  formulario: { label: "Formulários", color: "#10B981", priority: 4 },
};

export function useWhoSoldMetrics(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["who-sold-metrics", formatLocalDate(startDate), formatLocalDate(endDate)],
    queryFn: async (): Promise<WhoSoldCategory[]> => {
      const startStr = formatLocalDate(startDate);
      const endStr = formatLocalDate(endDate);

      // Use 7-day margin strategy for database query (same as other Kiwify hooks)
      const marginStart = new Date(startDate);
      marginStart.setDate(marginStart.getDate() - 7);
      const marginEnd = new Date(endDate);
      marginEnd.setDate(marginEnd.getDate() + 7);

      // Fetch paid events from kiwify_events (same source as Assinaturas)
      const { data: kiwifyEvents, error } = await supabase
        .from("kiwify_events")
        .select("*")
        .eq("event_type", "paid")
        .gte("created_at", marginStart.toISOString())
        .lte("created_at", marginEnd.toISOString());

      if (error) throw error;

      // Deduplicate by order_id and filter by approved_date
      const seenOrders = new Set<string>();
      const categoryMap = new Map<string, { sales: number; revenue: number }>();
      let totalRevenue = 0;

      for (const event of kiwifyEvents || []) {
        const payload = event.payload as any;
        if (!payload) continue;

        // Filter by approved_date within the selected period
        const approvedDate = payload.approved_date?.substring(0, 10);
        if (!approvedDate || approvedDate < startStr || approvedDate > endStr) {
          continue;
        }

        // Deduplicate by order_id
        const orderId = payload.order_id || event.id;
        if (seenOrders.has(orderId)) continue;
        seenOrders.add(orderId);

        // Get revenue (gross value)
        const commissions = payload.Commissions || {};
        const grossValue = Number(commissions.product_base_price || 0) / 100;
        totalRevenue += grossValue;

        // Detect category based on payload analysis (same logic as useKiwifyCompleteMetrics)
        let category = "organico";

        // 1. Check for affiliate commission
        const affiliateStore = commissions.commissioned_stores?.find(
          (s: any) => s.type === "affiliate"
        );
        const affiliateCommission = Number(affiliateStore?.value || 0) / 100;

        if (affiliateCommission > 0) {
          category = "afiliado";
        } else {
          // 2. Check for recurrence (renewal)
          const chargesCompleted = payload.Subscription?.charges?.completed || [];
          const isRenewal = chargesCompleted.length > 1;

          if (isRenewal) {
            category = "recorrencia";
          } else {
            // 3. Check lead_source for form-originated sales
            const leadSource = (payload.lead_source || "").toLowerCase();
            if (
              leadSource.includes("formulario") ||
              leadSource.includes("form") ||
              leadSource.includes("webchat") ||
              leadSource.includes("chat_widget")
            ) {
              category = "formulario";
            }
            // Default: organico
          }
        }

        // Accumulate stats
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { sales: 0, revenue: 0 });
        }

        const stats = categoryMap.get(category)!;
        stats.sales++;
        stats.revenue += grossValue;
      }

      // Convert to array with labels and percentages
      const result: WhoSoldCategory[] = Array.from(categoryMap.entries())
        .map(([category, stats]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.organico;
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
