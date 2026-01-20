import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatLocalDate } from "@/lib/dateUtils";
import { fetchProductMappings, getMappedProduct } from "@/lib/kiwifyProductMapping";

export interface RefundEvent {
  id: string;
  date: string;
  customerEmail: string;
  customerName: string;
  productName: string;
  value: number;
  reason: string | null;
  type: "refund" | "chargeback";
}

export function useRefundsTimeline(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["refunds-timeline", formatLocalDate(startDate), formatLocalDate(endDate)],
    queryFn: async (): Promise<RefundEvent[]> => {
      // Fetch product mappings
      const { offerMap, productIdMap } = await fetchProductMappings();
      
      // Fetch refund/chargeback events from kiwify_events
      const marginDays = 7;
      const startDateMinus = new Date(startDate);
      startDateMinus.setDate(startDateMinus.getDate() - marginDays);
      const endDatePlus = new Date(endDate);
      endDatePlus.setDate(endDatePlus.getDate() + marginDays);

      const { data: events, error } = await supabase
        .from("kiwify_events")
        .select("id, event_type, payload, created_at")
        .in("event_type", ["refunded", "chargedback"])
        .gte("created_at", startDateMinus.toISOString())
        .lte("created_at", endDatePlus.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const startStr = formatLocalDate(startDate);
      const endStr = formatLocalDate(endDate);

      // Process and filter events
      const refunds: RefundEvent[] = [];
      const seenOrderIds = new Set<string>();

      (events || []).forEach((event) => {
        const payload = event.payload as any;
        const orderId = payload?.order_id;
        
        if (!orderId || seenOrderIds.has(orderId)) return;
        
        // Check approved_date is in range
        const approvedDate = payload?.approved_date;
        if (!approvedDate) return;
        
        const eventDateStr = approvedDate.split(" ")[0];
        if (eventDateStr < startStr || eventDateStr > endStr) return;
        
        seenOrderIds.add(orderId);

        // Get product name using mapping
        const mappedProduct = getMappedProduct(payload, offerMap, productIdMap);
        
        // Extract customer info
        const customerEmail = payload?.Customer?.email || "Email não disponível";
        const customerName = payload?.Customer?.full_name || "Nome não disponível";
        
        // Get value in reais
        const value = Number(payload?.Commissions?.product_base_price || 0) / 100;
        
        // Try to get refund reason if available
        const reason = payload?.refund_reason || payload?.chargeback_reason || null;

        refunds.push({
          id: event.id,
          date: eventDateStr,
          customerEmail,
          customerName,
          productName: mappedProduct.name,
          value,
          reason,
          type: event.event_type === "chargedback" ? "chargeback" : "refund",
        });
      });

      return refunds;
    },
    staleTime: 30 * 1000,
  });
}
