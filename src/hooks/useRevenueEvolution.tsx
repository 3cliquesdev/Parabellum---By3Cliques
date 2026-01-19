import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatLocalDate } from "@/lib/dateUtils";

export function useRevenueEvolution() {
  return useQuery({
    queryKey: ["revenue-evolution-kiwify"],
    queryFn: async () => {
      // Add 7-day margin before the 6-month window for database optimization
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
      const queryStartDate = subDays(sixMonthsAgo, 7);
      
      console.log("📊 useRevenueEvolution: Buscando dados de kiwify_events", {
        desde: formatLocalDate(sixMonthsAgo),
        queryDesde: formatLocalDate(queryStartDate)
      });

      // Fetch paid events with a 7-day margin for optimization
      const { data: paidEvents, error: paidError } = await supabase
        .from("kiwify_events")
        .select("payload, created_at")
        .in("event_type", ["paid", "order_approved"])
        .gte("created_at", `${formatLocalDate(queryStartDate)}T00:00:00`)
        .order("created_at", { ascending: true });

      if (paidError) {
        console.error("❌ useRevenueEvolution: Erro ao buscar eventos:", paidError);
        throw paidError;
      }

      // Fetch refunded/chargedback order_ids to exclude
      const { data: refundedEvents } = await supabase
        .from("kiwify_events")
        .select("payload")
        .in("event_type", ["refunded", "chargedback"]);

      const refundedOrderIds = new Set<string>();
      refundedEvents?.forEach(event => {
        const orderId = (event.payload as any)?.order_id;
        if (orderId) refundedOrderIds.add(orderId);
      });

      console.log(`📊 useRevenueEvolution: ${refundedOrderIds.size} pedidos reembolsados excluídos`);

      // Deduplicate by order_id and exclude refunds
      const uniqueOrdersMap = new Map<string, any>();
      paidEvents?.forEach(event => {
        const payload = event.payload as any;
        const orderId = payload?.order_id;
        if (!orderId) return;
        if (refundedOrderIds.has(orderId)) return;
        if (!uniqueOrdersMap.has(orderId)) {
          uniqueOrdersMap.set(orderId, { ...event, payload });
        }
      });

      const events = Array.from(uniqueOrdersMap.values());
      console.log(`✅ useRevenueEvolution: ${events.length} pedidos únicos`);

      // Initialize last 6 months
      const revenueByMonth = new Map<
        string,
        { month: string; revenue: number; dealsCount: number }
      >();

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthKey = format(monthDate, "yyyy-MM");
        const monthLabel = format(monthDate, "MMM yyyy", { locale: ptBR });

        revenueByMonth.set(monthKey, {
          month: monthLabel,
          revenue: 0,
          dealsCount: 0,
        });
      }

      // Add values from kiwify events using approved_date
      events.forEach((event) => {
        // Use approved_date from payload for accurate period attribution
        const approvedDate = event.payload?.approved_date;
        if (!approvedDate) return;
        
        const monthKey = format(new Date(approvedDate), "yyyy-MM");
        const monthData = revenueByMonth.get(monthKey);

        if (monthData) {
          // Use my_commission (net revenue after Kiwify fees)
          const commissions = event.payload?.Commissions;
          const netValue = (commissions?.my_commission || 0) / 100;
          
          monthData.revenue += netValue;
          monthData.dealsCount += 1;
        }
      });

      const result = Array.from(revenueByMonth.values());
      console.log("✅ useRevenueEvolution: Dados calculados", result);
      
      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
