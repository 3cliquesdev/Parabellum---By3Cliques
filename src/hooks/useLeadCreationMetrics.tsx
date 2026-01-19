import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadSourceMetrics {
  source: string;
  created: number;
  won: number;
  lost: number;
  conversionRate: number;
  totalValue: number;
}

export interface DailyMetrics {
  date: string;
  totalCreated: number;
  totalWon: number;
  totalLost: number;
  totalOpenValue: number;
  totalWonValue: number;
  bySource: LeadSourceMetrics[];
  kiwifyEvents: {
    total: number;
    newCustomers: number;
    recurring: number;
    totalGross: number;
    totalNet: number;
  };
}

// Helper to format date to local YYYY-MM-DD (avoids timezone issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useLeadCreationMetrics(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["lead-creation-metrics", formatLocalDate(startDate), formatLocalDate(endDate)],
    queryFn: async (): Promise<DailyMetrics> => {
      const startStr = formatLocalDate(startDate);
      const endStr = formatLocalDate(endDate);
      
      // Use consistent datetime boundaries (local timezone)
      const startDateTime = `${startStr}T00:00:00`;
      const endDateTime = `${endStr}T23:59:59`;

      // 1. Fetch deals created in period
      const { data: dealsCreated, error: createdError } = await supabase
        .from("deals")
        .select("id, status, value, lead_source, created_at, closed_at")
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      if (createdError) throw createdError;

      // 2. Fetch deals closed (won) in period
      const { data: dealsWon, error: wonError } = await supabase
        .from("deals")
        .select("id, status, value, lead_source, closed_at")
        .eq("status", "won")
        .gte("closed_at", startDateTime)
        .lte("closed_at", endDateTime);

      if (wonError) throw wonError;

      // 3. Fetch deals closed (lost) in period
      const { data: dealsLost, error: lostError } = await supabase
        .from("deals")
        .select("id, status, value, lead_source, closed_at")
        .eq("status", "lost")
        .gte("closed_at", startDateTime)
        .lte("closed_at", endDateTime);

      if (lostError) throw lostError;

      // 4. Fetch Kiwify events (approved sales) in period
      // Use a wider date range and filter by approved_date in memory
      // because the approved_date is inside the payload JSON
      const startDateMinus7 = new Date(startDate);
      startDateMinus7.setDate(startDateMinus7.getDate() - 7);
      const endDatePlus7 = new Date(endDate);
      endDatePlus7.setDate(endDatePlus7.getDate() + 7);
      
      const { data: allKiwifyEvents, error: kiwifyError } = await supabase
        .from("kiwify_events")
        .select("id, event_type, customer_email, payload, linked_deal_id, created_at")
        .in("event_type", ["paid", "order_approved", "order_paid"])
        .gte("created_at", formatLocalDate(startDateMinus7))
        .lte("created_at", endDatePlus7.toISOString());

      if (kiwifyError) throw kiwifyError;

      // Filter by approved_date from payload (the actual transaction date)
      const kiwifyEvents = (allKiwifyEvents || []).filter(event => {
        const payload = event.payload as any;
        const approvedDateStr = payload?.approved_date;
        if (!approvedDateStr) return false;
        
        // Extract just the date part (YYYY-MM-DD)
        const approvedDate = approvedDateStr.substring(0, 10);
        return approvedDate >= startStr && approvedDate <= formatLocalDate(endDate);
      });

      // Process deals by source
      const sourceMap = new Map<string, LeadSourceMetrics>();
      
      const getOrCreateSource = (source: string | null) => {
        const key = source || "manual";
        if (!sourceMap.has(key)) {
          sourceMap.set(key, {
            source: key,
            created: 0,
            won: 0,
            lost: 0,
            conversionRate: 0,
            totalValue: 0,
          });
        }
        return sourceMap.get(key)!;
      };

      // Count created deals by source
      let totalOpenValue = 0;
      (dealsCreated || []).forEach((deal) => {
        const metrics = getOrCreateSource(deal.lead_source);
        metrics.created++;
        if (deal.status === "open") {
          totalOpenValue += deal.value || 0;
        }
      });

      // Count won deals by source
      let totalWonValue = 0;
      (dealsWon || []).forEach((deal) => {
        const metrics = getOrCreateSource(deal.lead_source);
        metrics.won++;
        metrics.totalValue += deal.value || 0;
        totalWonValue += deal.value || 0;
      });

      // Count lost deals by source
      (dealsLost || []).forEach((deal) => {
        const metrics = getOrCreateSource(deal.lead_source);
        metrics.lost++;
      });

      // Calculate conversion rates
      sourceMap.forEach((metrics) => {
        if (metrics.created > 0) {
          metrics.conversionRate = (metrics.won / metrics.created) * 100;
        }
      });

      // Process Kiwify events
      const kiwifyMetrics = {
        total: kiwifyEvents?.length || 0,
        newCustomers: 0,
        recurring: 0,
        totalGross: 0,
        totalNet: 0,
      };

      const seenEmails = new Set<string>();
      (kiwifyEvents || []).forEach((event) => {
        const payload = event.payload as any;
        const grossValue = (payload?.Commissions?.product_base_price || 0) / 100;
        const netValue = (payload?.Commissions?.my_commission || payload?.Commissions?.product_base_price || 0) / 100;

        kiwifyMetrics.totalGross += grossValue;
        kiwifyMetrics.totalNet += netValue;

        // Check if first time we see this email in period (new customer vs recurring)
        const email = event.customer_email;
        if (!seenEmails.has(email)) {
          seenEmails.add(email);
          kiwifyMetrics.newCustomers++;
        } else {
          kiwifyMetrics.recurring++;
        }
      });

      // Adjust recurring count (first occurrence is always "new", subsequent are "recurring")
      // The logic above counts unique emails as newCustomers, so recurring = total - unique
      kiwifyMetrics.recurring = kiwifyMetrics.total - kiwifyMetrics.newCustomers;

      // Sort sources by created count descending
      const bySource = Array.from(sourceMap.values()).sort((a, b) => b.created - a.created);

      return {
        date: startStr,
        totalCreated: dealsCreated?.length || 0,
        totalWon: dealsWon?.length || 0,
        totalLost: dealsLost?.length || 0,
        totalOpenValue,
        totalWonValue,
        bySource,
        kiwifyEvents: kiwifyMetrics,
      };
    },
    staleTime: 30 * 1000, // 30 seconds for more reactive updates
    refetchOnWindowFocus: true,
  });
}

// Get friendly name for lead sources
export function getLeadSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    manual: "Manual",
    formulario: "Formulário",
    form: "Formulário",
    whatsapp: "WhatsApp",
    chat_widget: "Chat Web",
    webchat: "Chat Web",
    indicacao: "Indicação",
    referral: "Indicação",
    kiwify_direto: "Kiwify (Novo Cliente)",
    kiwify_recorrencia: "Kiwify (Recorrência)",
    kiwify_organic: "Kiwify Orgânico",
    recuperacao: "Recuperação",
    recovery: "Recuperação",
    legado: "Legado",
    legacy: "Legado",
  };
  return labels[source.toLowerCase()] || source;
}

// Get color for lead source
export function getLeadSourceColor(source: string): string {
  const colors: Record<string, string> = {
    manual: "#6B7280",
    formulario: "#8B5CF6",
    form: "#8B5CF6",
    whatsapp: "#22C55E",
    chat_widget: "#3B82F6",
    webchat: "#3B82F6",
    indicacao: "#F59E0B",
    referral: "#F59E0B",
    kiwify_direto: "#10B981",
    kiwify_recorrencia: "#14B8A6",
    kiwify_organic: "#059669",
    recuperacao: "#EF4444",
    recovery: "#EF4444",
    legado: "#9CA3AF",
    legacy: "#9CA3AF",
  };
  return colors[source.toLowerCase()] || "#6B7280";
}
